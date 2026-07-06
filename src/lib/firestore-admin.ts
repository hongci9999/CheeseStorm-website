// 서버 전용 Firestore write — Admin SDK 사용으로 보안 규칙 우회.
// 클라이언트 컴포넌트에서 직접 import 금지. API 라우트에서만 사용.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { getCuratedTierLists, packMatchForStore, type PrecomputedProfile } from './firestore';
import { calcPlayerStats } from './tier';
import { calcHeroTiers } from './hero-tier';
import { normalizeOcrKey } from './ocr-corrections';
import { emptyTierLists, CURATED_TIER_ORDER } from './curated-tier';
import { kdaFor, getRecentMatches } from './profile';
import { fineRoleAffinity } from './heroes';
import { aggregateHeroStats } from './hero-stats';
import { computeRelations } from './relations';
import { mapWinRates } from './map-stats';
import type { Match, Streamer, CuratedTierLists } from './types';

type StoredPick = { id: string; hero: string };
function packTeam(team: [string, string][]): StoredPick[] {
  return team.map(([id, hero]) => ({ id, hero }));
}
function unpackTeam(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) =>
    Array.isArray(p)
      ? ([p[0], p[1]] as [string, string])
      : ([(p as StoredPick).id, (p as StoredPick).hero] as [string, string]),
  );
}

// Admin SDK로 reads — 보안 규칙 우회, refreshStats() 전용
async function getStreamersAdmin(): Promise<Streamer[]> {
  const snap = await getAdminDb().collection('streamers').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Streamer));
}
async function getMatchesAdmin(): Promise<Match[]> {
  const snap = await getAdminDb().collection('matches').orderBy('date', 'desc').get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      blueTeam: unpackTeam(data.blueTeam),
      redTeam: unpackTeam(data.redTeam),
      date: data.date.toDate(),
      createdAt: data.createdAt.toDate(),
    } as Match;
  });
}

async function refreshStats(): Promise<void> {
  try {
    const [streamers, matches] = await Promise.all([getStreamersAdmin(), getMatchesAdmin()]);
    const playerStats = calcPlayerStats(streamers, matches);
    const heroTiers = calcHeroTiers(matches);

    const profiles: Record<string, PrecomputedProfile> = {};
    for (const s of streamers) {
      const played = getRecentMatches(s.id, matches, Infinity);
      const { synergy, nemesis } = computeRelations(s.id, streamers, matches);
      profiles[s.id] = {
        streamerName: s.name,
        ...(s.profileImageUrl !== undefined ? { profileImageUrl: s.profileImageUrl } : {}),
        ...(s.gameNames !== undefined ? { gameNames: s.gameNames } : {}),
        ...(s.accountLevel !== undefined ? { accountLevel: s.accountLevel } : {}),
        kda: kdaFor(matches, s.id),
        roleAffinity: fineRoleAffinity(matches, s.id),
        heroAggregates: aggregateHeroStats(s.id, matches),
        synergy,
        nemesis,
        maps: mapWinRates(s.id, matches),
        recentMatches: played.slice(0, 6).map(packMatchForStore),
        allMatches: played.map(packMatchForStore),
      };
    }

    const clean = (v: unknown) => JSON.parse(JSON.stringify(v));
    await getAdminDb().collection('stats').doc('current').set({
      playerStats: clean(playerStats),
      heroTiers: clean(heroTiers),
      profiles: clean(profiles),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[refreshStats] 집계 실패:', err);
  }
}

// 큐레이션 티어 수정자 — 누가 저장했는지 로그용 (없으면 시스템 자동 정리)
type TierEditor = { chzzkId: string; name: string; isAdmin?: boolean };
const UNPLACED = '(미배정)';

// 티어별 ID 목록을 "스트리머ID → 티어" 맵으로 뒤집는다 (diff 계산용)
function tierByStreamer(lists?: CuratedTierLists): Map<string, string> {
  const m = new Map<string, string>();
  if (!lists) return m;
  for (const tier of CURATED_TIER_ORDER) {
    for (const id of lists[tier] ?? []) m.set(id, tier);
  }
  return m;
}

// 이전↔새 배치를 비교해 티어가 바뀐 스트리머만 추린다.
function diffTierChanges(
  prev: CuratedTierLists | undefined,
  next: CuratedTierLists,
  nameOf: Map<string, string>,
): { streamerId: string; name: string; from: string; to: string }[] {
  const before = tierByStreamer(prev);
  const after = tierByStreamer(next);
  const ids = new Set([...before.keys(), ...after.keys()]);
  const changes: { streamerId: string; name: string; from: string; to: string }[] = [];
  for (const id of ids) {
    const from = before.get(id) ?? UNPLACED;
    const to = after.get(id) ?? UNPLACED;
    if (from !== to) changes.push({ streamerId: id, name: nameOf.get(id) ?? id, from, to });
  }
  return changes;
}

export async function saveCuratedTierLists(
  lists: CuratedTierLists,
  editor?: TierEditor,
): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection('curatedTiers').doc('current');

  // diff용: 저장 전 현재 배치 + 스트리머 이름 맵을 먼저 읽는다
  const [prevSnap, streamers] = await Promise.all([ref.get(), getStreamersAdmin()]);
  const prevLists = prevSnap.exists ? (prevSnap.data()?.lists as CuratedTierLists | undefined) : undefined;
  const nameOf = new Map(streamers.map(s => [s.id, s.name]));
  const changes = diffTierChanges(prevLists, lists, nameOf);

  await ref.set(
    {
      lists,
      updatedAt: FieldValue.serverTimestamp(),
      // 재조정 안내 노출 판단용: 마지막 수정자가 제작자(admin)인지. 비관리자 수정 시 안내 숨김.
      // editor 없음(시스템 자동 정리)은 관리자 아님으로 취급.
      lastEditByAdmin: editor?.isAdmin === true,
    },
    { merge: true },
  );
  // 수정 이력 로그 — 누가·언제·누구를 어디로 옮겼는지 기록 (Firestore 콘솔 확인).
  // 콘솔은 문서 ID 오름차순 정렬 → 역타임스탬프를 ID로 써서 최신이 맨 위로.
  const reverseId = String(9_999_999_999_999 - Date.now()).padStart(13, '0');
  await db.collection('curatedTiersHistory').doc(reverseId).set({
    editedBy: editor?.chzzkId ?? '(system)',
    editedByName: editor?.name ?? '(시스템 자동 정리)',
    editedAt: FieldValue.serverTimestamp(),
    changes,
  });
}

async function removeCuratedPlacement(streamerId: string): Promise<void> {
  const current = await getCuratedTierLists();
  const has = CURATED_TIER_ORDER.some((t) => current[t].includes(streamerId));
  if (!has) return;
  const next = emptyTierLists();
  for (const tier of CURATED_TIER_ORDER) {
    next[tier] = current[tier].filter((id) => id !== streamerId);
  }
  await saveCuratedTierLists(next);
}

// ── Streamers ────────────────────────────────────────────────

export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await getAdminDb().collection('streamers').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  await refreshStats();
  return ref.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).delete();
  await removeCuratedPlacement(id);
  await refreshStats();
}

export async function updateStreamerInfo(id: string, name: string, accountLevel?: number): Promise<void> {
  const payload: Record<string, unknown> = { name };
  if (accountLevel !== undefined) payload.accountLevel = accountLevel;
  await getAdminDb().collection('streamers').doc(id).update(payload);
  await refreshStats();
}

export async function updateStreamerGameNames(id: string, gameNames: string[]): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({ gameNames });
  await refreshStats();
}

export async function updateStreamerProfileImage(id: string, imageUrl: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({
    profileImageUrl: imageUrl,
    profileImageUpdatedAt: FieldValue.serverTimestamp(),
  });
  await refreshStats();
}

// ── Matches ──────────────────────────────────────────────────

export async function addMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<string> {
  const payload: Record<string, unknown> = {
    ...data,
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
    createdAt: FieldValue.serverTimestamp(),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  const ref = await getAdminDb().collection('matches').add(payload);
  await refreshStats();
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await getAdminDb().collection('matches').doc(id).delete();
  await refreshStats();
}

export async function updateMatch(id: string, data: Omit<Match, 'id' | 'createdAt'>): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  await getAdminDb().collection('matches').doc(id).update(payload);
  await refreshStats();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await getAdminDb().collection('matches').doc(id).update({ date });
  await refreshStats();
}

// ── Curated tiers already exported above ────────────────────

// ── OCR ──────────────────────────────────────────────────────

export async function upsertOcrCorrection(
  kind: 'streamer' | 'hero', wrong: string, correct: string,
): Promise<void> {
  const key = normalizeOcrKey(wrong);
  if (!key || !correct.trim()) return;
  const field = kind === 'streamer' ? 'streamers' : 'heroes';
  await getAdminDb().collection('ocrCorrections').doc('global').set(
    { [`${field}.${key}`]: correct.trim(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
