// 서버 전용 Firestore write — Admin SDK 사용으로 보안 규칙 우회.
// 클라이언트 컴포넌트에서 직접 import 금지. API 라우트에서만 사용.

import { waitUntil } from '@vercel/functions';
import { revalidateTag } from 'next/cache';
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
import type { SessionPayload } from './session';
import type { Match, Streamer, CuratedTierLists } from './types';
import type { Scrim } from './scrim';
import {
  buildTournamentData, tournamentDayKeys, wrapMatrix,
  TOURNAMENT_NAME, TOURNAMENT_SEASON, TOURNAMENT_TEAMS,
  type TournamentGameLink,
} from './tournament';

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

    // profiles는 stats/current 문서 크기(1MiB 제한)를 넘기지 않도록 서브컬렉션에 분리 저장.
    // 전 스트리머 전체 경기이력을 한 문서에 통째로 넣던 옛 구조는 경기 늘수록 문서가
    // 무한정 커져 쓰기 자체가 거부됐음.
    const db = getAdminDb();
    const profilesCol = db.collection('stats').doc('current').collection('profiles');
    const existingProfileRefs = await profilesCol.listDocuments();
    const currentIds = new Set(streamers.map((s) => s.id));

    const batch = db.batch();
    for (const s of streamers) {
      batch.set(profilesCol.doc(s.id), clean(profiles[s.id]));
    }
    for (const ref of existingProfileRefs) {
      if (!currentIds.has(ref.id)) batch.delete(ref); // 삭제된 스트리머 프로필 정리
    }
    // streamers 컬렉션에 eloRating 저장
    for (const stat of playerStats) {
      batch.update(db.collection('streamers').doc(stat.streamerId), {
        eloRating: stat.eloRating,
      });
    }
    batch.set(db.collection('stats').doc('current'), {
      playerStats: clean(playerStats),
      heroTiers: clean(heroTiers),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    // matches/streamers와 달리 stats/current는 이 백그라운드 집계가 실제 쓰기 시점이라
    // 여기서 무효화해야 함 — API 라우트 쪽 revalidateTag('matches')는 이 문서를 안 건드림.
    revalidateTag('stats', 'max');
    // 응답 종료 후(waitUntil) 컨텍스트의 revalidateTag는 전파가 씹힐 수 있어(ADR-0018 계열)
    // self-fetch로 요청 컨텍스트 안에서 한 번 더 확실히 무효화한다.
    await pingRevalidate('stats');
  } catch (err) {
    console.error('[refreshStats] 집계 실패:', err);
  }
}

// /api/revalidate self-fetch — 베이스 URL 불명(로컬 등)이면 스킵 (직접 revalidateTag로 충분).
async function pingRevalidate(tag: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) return;
  try {
    await fetch(`${base}/api/revalidate?tag=${tag}`, {
      method: 'POST',
      ...(process.env.REVALIDATE_SECRET
        ? { headers: { 'x-revalidate-secret': process.env.REVALIDATE_SECRET } }
        : {}),
    });
  } catch (err) {
    console.error('[refreshStats] revalidate ping 실패:', err);
  }
}

// 응답 반환 후에도 Fluid Compute가 함수를 유지해 백그라운드로 완료 보장.
// next/server의 after()는 이 배포 환경에서 콜백이 씹히는 문제가 있어 (ADR-0018)
// 더 저수준 API인 @vercel/functions waitUntil로 교체.
function scheduleRefresh(): void {
  waitUntil(refreshStats());
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

// ── 대회 경기 태깅 (tournamentGames) ─────────────────────────
// matches와 별개 컬렉션 — 문서 id = matchId(1:1). 경기 입력/수정 시점에 명시적으로 남긴다.
// 티어·Elo 집계와 무관 → refreshStats 불필요.

// 태그 컬렉션과 경기 문서의 tournament 플래그를 항상 함께 쓴다 —
// 플래그는 Elo 제외 판정용 비정규화 값이라 두 곳이 어긋나면 Elo가 조용히 틀어진다 (ADR-0022).
export async function linkMatchToTournament(
  matchId: string, blueTeamId: string, redTeamId: string,
): Promise<void> {
  const db = getAdminDb();
  await db.collection('tournamentGames').doc(matchId).set({
    blueTeamId, redTeamId, createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection('matches').doc(matchId).update({ tournament: true });
  // addMatch/updateMatch가 이미 예약한 refresh는 플래그가 쓰이기 전에 경기를 읽을 수 있다.
  // 플래그 확정 후 한 번 더 예약해 Elo 집계가 대회 경기를 확실히 제외하도록 한다.
  scheduleRefresh();
}

// 경기 삭제 시의 고아 태그 정리에도 쓰이므로, 호출 전에 경기 문서를 지우면 안 된다
// (지운 뒤 호출하면 플래그 해제가 NOT_FOUND로 실패한다 — DELETE 라우트는 unlink를 먼저 부른다).
export async function unlinkMatchFromTournament(matchId: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection('tournamentGames').doc(matchId);
  // 태그가 없던 경기면 지울 것도 재집계할 것도 없다 — 경기 삭제마다 불리므로 여기서 끊는다.
  if (!(await ref.get()).exists) return;
  await ref.delete();
  await db.collection('matches').doc(matchId).update({ tournament: FieldValue.delete() });
  scheduleRefresh();
}

// ── 대회 결과 스냅샷 (대회 종료 후 고정) ─────────────────────
// 대회가 끝나면 로스터·경기가 더 바뀌지 않으므로, 매 요청마다 재집계하는 대신
// 관리자가 한 번 호출해 계산 결과를 통째로 저장한다. 이후 /tournament는 이 문서만 읽고,
// 문서가 없을 때만(다음 대회 진행 중 등) buildTournamentData로 라이브 집계 폴백한다.
export async function finalizeTournamentResults(): Promise<void> {
  const db = getAdminDb();
  const [streamers, matches, linksSnap] = await Promise.all([
    getStreamersAdmin(), getMatchesAdmin(), db.collection('tournamentGames').get(),
  ]);
  const links: TournamentGameLink[] = linksSnap.docs.map((d) => {
    const data = d.data();
    return {
      matchId: d.id,
      blueTeamId: data.blueTeamId,
      redTeamId: data.redTeamId,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    };
  });

  // h2h·teamMaps는 2차원 배열이라 Firestore가 그대로 못 받는다(중첩 배열 금지) — wrapMatrix로 감싼다.
  const wrapDay = (d: ReturnType<typeof buildTournamentData>) =>
    ({ ...d, h2h: wrapMatrix(d.h2h), teamMaps: wrapMatrix(d.teamMaps) });
  const days = [
    { key: 'all', label: '전체', data: wrapDay(buildTournamentData(matches, links, streamers)) },
    ...tournamentDayKeys(matches, links).map((key, i) => ({
      key, label: `${i + 1}일차`,
      data: wrapDay(buildTournamentData(matches, links, streamers, TOURNAMENT_TEAMS, key)),
    })),
  ];

  await db.collection('tournamentResults').doc('current').set({
    name: TOURNAMENT_NAME,
    season: TOURNAMENT_SEASON,
    // Firestore는 undefined 필드를 거부 — 직렬화 왕복으로 정리(refreshStats의 clean()과 동일 패턴).
    days: JSON.parse(JSON.stringify(days)),
    finalizedAt: FieldValue.serverTimestamp(),
  });
  revalidateTag('tournamentResults', 'max');
}

// ── Scrims (프로 스크림 밴픽 기록) ───────────────────────────
// 티어·Elo 집계와 무관 → refreshStats 불필요.

export async function addScrim(data: Omit<Scrim, 'id' | 'createdAt'>): Promise<string> {
  const payload: Record<string, unknown> = {
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]; // patch 등 선택 필드
  }
  const ref = await getAdminDb().collection('scrims').add(payload);
  return ref.id;
}

// 같은 세트(seriesId)에 이미 저장된 경기들의 픽 전체 — 하드 피어리스 서버측 검증용.
export async function getSeriesPickedHeroes(seriesId: string): Promise<string[]> {
  const snap = await getAdminDb().collection('scrims').where('seriesId', '==', seriesId).get();
  return snap.docs.flatMap((d) => {
    const picks = d.data().picks as Partial<Record<'blue' | 'red', string[]>> | undefined;
    return [...(picks?.blue ?? []), ...(picks?.red ?? [])];
  });
}

export async function deleteScrim(id: string): Promise<void> {
  await getAdminDb().collection('scrims').doc(id).delete();
}

// 과거(seriesId 없는) 또는 잘못 나뉜 기록을 관리자가 수동으로 한 세트로 묶을 때 사용.
// seriesId=null이면 묶음 해제(필드 삭제) — 다시 각자 1경기짜리 세트로 돌아감.
export async function setScrimsSeries(ids: string[], seriesId: string | null): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection('scrims').doc(id), {
      seriesId: seriesId ?? FieldValue.delete(),
    });
  }
  await batch.commit();
}

// ── Curated tiers already exported above ────────────────────

// ── 방문 로그 ────────────────────────────────────────────────

const VISIT_BUCKET_MS = 5 * 60_000; // 5분 단위로 방문 기록 묶음

// 티어리스트 방문 로그 — 스트리머 이상만 기록 (미들웨어에서 호출)
// 문서ID를 역타임스탬프(5분단위)+스트리머로 고정 — 콘솔은 문서ID 오름차순 정렬이라
// 역타임스탬프를 앞에 두면 최신 기록이 맨 위로 옴. 같은 5분 구간 안 재방문(새로고침 연타·
// prefetch 잔여)은 같은 ID로 덮어써지고, 구간이 바뀌면 새 기록으로 남음
const VISIT_LOG_EXCLUDED_NAMES = new Set(['그레도']);

// paths: 그 5분 구간에 본 페이지 경로 누적 — arrayUnion이라 중복 없이 쌓이고
// 기존 값을 읽을 필요가 없다(문서당 쓰기 1회). 배열 순서 = 처음 방문한 순서.
export async function logTierlistVisit(session: SessionPayload, path = '/'): Promise<void> {
  if (session.dev) return; // 개발용 임시 로그인 방문은 기록 안 함
  if (VISIT_LOG_EXCLUDED_NAMES.has(session.name)) return;
  const bucketEpochMs = Math.floor(Date.now() / VISIT_BUCKET_MS) * VISIT_BUCKET_MS;
  const reverseBucket = String(9_999_999_999_999 - bucketEpochMs).padStart(13, '0');
  const id = `${reverseBucket}_${session.chzzkId}`;
  await getAdminDb().collection('tierlistVisits').doc(id).set(
    {
      chzzkId: session.chzzkId,
      name: session.name,
      role: session.role,
      paths: FieldValue.arrayUnion(path),
      visitedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// ── OCR ──────────────────────────────────────────────────────

export async function upsertOcrCorrection(
  kind: 'streamer' | 'hero', wrong: string, correct: string,
): Promise<void> {
  const key = normalizeOcrKey(wrong);
  if (!key || !correct.trim()) return;
  const field = kind === 'streamer' ? 'streamers' : 'heroes';
  // dotted key(`${field}.${key}`)로 set(merge)하면 중첩 map이 아니라 점 포함 플랫 필드가 생성됨
  // (Firestore Console 트리뷰는 이를 중첩처럼 보여줘 착시를 일으킴) — 반드시 중첩 객체로 써야 함
  await getAdminDb().collection('ocrCorrections').doc('global').set(
    { [field]: { [key]: correct.trim() }, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
