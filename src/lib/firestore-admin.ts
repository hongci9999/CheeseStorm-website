// 서버 전용 Firestore write — Admin SDK 사용으로 보안 규칙 우회.
// 클라이언트 컴포넌트에서 직접 import 금지. API 라우트에서만 사용.

import { after } from 'next/server';
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

// 응답 반환 후 재집계를 보장 실행한다 (Vercel이 after 콜백 완료까지 함수를 유지).
// fire-and-forget(void)와 달리 서버리스 동결로 집계가 잘리지 않는다 (ADR-0018).
// 요청 컨텍스트 밖(스크립트 등)에서 호출되면 after가 throw하므로 void로 폴백.
function scheduleRefresh(): void {
  try {
    after(refreshStats);
  } catch {
    void refreshStats();
  }
}

export async function saveCuratedTierLists(lists: CuratedTierLists): Promise<void> {
  await getAdminDb().collection('curatedTiers').doc('current').set(
    { lists, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
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
  scheduleRefresh();
  return ref.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).delete();
  await removeCuratedPlacement(id);
  scheduleRefresh();
}

export async function updateStreamerInfo(id: string, name: string, accountLevel?: number): Promise<void> {
  const payload: Record<string, unknown> = { name };
  if (accountLevel !== undefined) payload.accountLevel = accountLevel;
  await getAdminDb().collection('streamers').doc(id).update(payload);
  scheduleRefresh();
}

export async function updateStreamerGameNames(id: string, gameNames: string[]): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({ gameNames });
  scheduleRefresh();
}

export async function updateStreamerProfileImage(id: string, imageUrl: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({
    profileImageUrl: imageUrl,
    profileImageUpdatedAt: FieldValue.serverTimestamp(),
  });
  scheduleRefresh();
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
  scheduleRefresh();
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await getAdminDb().collection('matches').doc(id).delete();
  scheduleRefresh();
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
  scheduleRefresh();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await getAdminDb().collection('matches').doc(id).update({ date });
  scheduleRefresh();
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
