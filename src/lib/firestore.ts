import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  where,
  limit,
  arrayUnion,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { cache } from 'react';
import { db, isFirebaseConfigured } from './firebase';
export { isFirebaseConfigured };
import { calcPlayerStats } from './tier';
import { calcHeroTiers } from './hero-tier';
import type { PlayerStats } from './types';
import type { HeroTierStat } from './hero-tier';
import type { Match, OcrCorrections, CuratedTierLists, Streamer } from './types';
import { emptyTierLists, listsFromPlacements, sanitizeLists, CURATED_TIER_ORDER } from './curated-tier';
import { EMPTY_OCR_CORRECTIONS, normalizeOcrKey } from './ocr-corrections';
import { normalizeMatchDur } from './match';

// --- 클라이언트 세션 캐시 ---
// SPA 내비게이션마다 같은 데이터를 다시 요청하고 로딩 스피너를 띄우는 걸 막는다.
// 서버 컴포넌트에서는 요청 간 캐시가 공유되어 stale될 위험이 있으므로 클라이언트에서만 캐시.
const isClient = typeof window !== 'undefined';
let streamersCache: Streamer[] | null = null;
let matchesCache: Match[] | null = null;
let statsCache: { playerStats: PlayerStats[]; heroTiers: HeroTierStat[] } | null = null;

// 페이지가 첫 렌더에서 동기적으로 읽어 스피너 없이 즉시 그리기 위한 getter. 없으면 null.
export function getCachedStreamers(): Streamer[] | null {
  return streamersCache;
}

export function invalidateStreamersCache() { streamersCache = null; }
export function invalidateMatchesCache() { matchesCache = null; }
export function invalidateCuratedListsCache() { curatedListsCache = null; }
export function getCachedMatches(): Match[] | null {
  return matchesCache;
}

// --- Streamers ---

export async function getStreamers(opts?: { fresh?: boolean }): Promise<Streamer[]> {
  if (opts?.fresh) streamersCache = null;
  if (isClient && streamersCache !== null) return streamersCache;
  const q = query(collection(db, 'streamers'), orderBy('name'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => {
    const data = d.data();
    const updatedAt = data.profileImageUpdatedAt as Timestamp | undefined;
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      // 저장돼 있으면 Date로 변환 (없으면 필드 자체를 제외해 undefined 유지)
      ...(updatedAt ? { profileImageUpdatedAt: updatedAt.toDate() } : {}),
    };
  }) as Streamer[];
  if (isClient) streamersCache = list;
  return list;
}

export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'streamers'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  streamersCache = null; // 변경됨 → 다음 조회 시 새로고침
  void refreshStats();
  return ref.id;
}

// chzzkId로 스트리머 단건 조회 (권한 해석에 사용)
export async function getStreamerByChzzkId(chzzkId: string): Promise<Streamer | null> {
  const q = query(collection(db, 'streamers'), where('chzzkId', '==', chzzkId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  const updatedAt = data.profileImageUpdatedAt as Timestamp | undefined;
  return {
    id: d.id,
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate(),
    ...(updatedAt ? { profileImageUpdatedAt: updatedAt.toDate() } : {}),
  } as Streamer;
}

export async function deleteStreamer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'streamers', id));
  await removeCuratedPlacement(id);
  streamersCache = null;
  void refreshStats();
}

// 미매칭 슬롯 자가학습: 인게임 이름을 스트리머의 gameNames에 append.
// 이미 존재하는 값이면 Firestore arrayUnion이 중복을 방지한다.
export async function appendGameName(streamerId: string, gameName: string): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), {
    gameNames: arrayUnion(gameName),
  });
  streamersCache = null;
}

// 스트리머의 gameNames 전체를 교체 (편집 모달에서 직접 수정할 때 사용).
export async function updateStreamerGameNames(streamerId: string, gameNames: string[]): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), { gameNames });
  streamersCache = null;
}

// 스트리머 기본 정보(이름·계정레벨) 수정. accountLevel 미지정 시 해당 필드는 건드리지 않는다.
export async function updateStreamerInfo(
  streamerId: string,
  name: string,
  accountLevel?: number,
): Promise<void> {
  const payload: Record<string, unknown> = { name };
  if (accountLevel !== undefined) payload.accountLevel = accountLevel;
  await updateDoc(doc(db, 'streamers', streamerId), payload);
  streamersCache = null;
}

// 치지직에서 가져온 프로필 사진 URL과 갱신 시각을 저장.
// imageUrl이 빈 문자열이어도 갱신 시각은 기록 — TTL이 지나기 전 재조회를 막는다.
export async function updateStreamerProfileImage(streamerId: string, imageUrl: string): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), {
    profileImageUrl: imageUrl,
    profileImageUpdatedAt: Timestamp.now(),
  });
  streamersCache = null;
}

// --- OCR 교정맵 (AI 오답 → 정답) ---

let ocrCorrectionsCache: OcrCorrections | null = null;

export async function getOcrCorrections(): Promise<OcrCorrections> {
  if (isClient && ocrCorrectionsCache) return ocrCorrectionsCache;
  const d = await getDoc(doc(db, 'ocrCorrections', 'global'));
  if (!d.exists()) {
    if (isClient) ocrCorrectionsCache = EMPTY_OCR_CORRECTIONS;
    return EMPTY_OCR_CORRECTIONS;
  }
  const data = d.data();
  const list: OcrCorrections = {
    streamers: (data.streamers as Record<string, string>) ?? {},
    heroes: (data.heroes as Record<string, string>) ?? {},
  };
  if (isClient) ocrCorrectionsCache = list;
  return list;
}

export async function upsertOcrCorrection(
  kind: 'streamer' | 'hero',
  wrong: string,
  correct: string,
): Promise<void> {
  const key = normalizeOcrKey(wrong);
  if (!key || !correct.trim()) return;
  const field = kind === 'streamer' ? 'streamers' : 'heroes';
  await setDoc(doc(db, 'ocrCorrections', 'global'), {
    [`${field}.${key}`]: correct.trim(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  ocrCorrectionsCache = null;
}

// --- 큐레이션 티어 (ADR-0005) — 티어별 순서 있는 스트리머 ID 목록 ---

let curatedListsCache: CuratedTierLists | null = null;

export async function getCuratedTierLists(
  streamerIds?: Iterable<string>,
): Promise<CuratedTierLists> {
  if (isClient && curatedListsCache && !streamerIds) return curatedListsCache;

  const d = await getDoc(doc(db, 'curatedTiers', 'current'));
  if (!d.exists()) {
    const empty = emptyTierLists();
    if (isClient) curatedListsCache = empty;
    return empty;
  }

  const data = d.data();
  let lists: CuratedTierLists;
  if (data.lists) {
    lists = data.lists as CuratedTierLists;
  } else if (data.placements) {
    // 레거시 streamerId → tier 맵 마이그레이션
    const ids = streamerIds ? [...streamerIds] : Object.keys(data.placements as object);
    const streamers = ids.map((id) => ({ id, name: id }));
    lists = listsFromPlacements(data.placements as Record<string, import('./types').CuratedTier>, streamers);
  } else {
    lists = emptyTierLists();
  }

  if (streamerIds) lists = sanitizeLists(lists, streamerIds);
  if (isClient) curatedListsCache = lists;
  return lists;
}

export async function saveCuratedTierLists(lists: CuratedTierLists): Promise<void> {
  await setDoc(doc(db, 'curatedTiers', 'current'), {
    lists,
    updatedAt: Timestamp.now(),
  }, { merge: true });
  curatedListsCache = lists;
}

// 스트리머 삭제 시 모든 티어 목록에서 제거
export async function removeCuratedPlacement(streamerId: string): Promise<void> {
  const current = await getCuratedTierLists();
  const has = CURATED_TIER_ORDER.some((t) => current[t].includes(streamerId));
  if (!has) return;
  const next = emptyTierLists();
  for (const tier of CURATED_TIER_ORDER) {
    next[tier] = current[tier].filter((id) => id !== streamerId);
  }
  await saveCuratedTierLists(next);
}

// 하위 호환 alias
export const getCuratedTiers = getCuratedTierLists;
export const saveCuratedTiers = saveCuratedTierLists;

// --- 사전집계 통계 ---

// 사전집계된 티어 데이터 조회 — 없으면 null (폴백: 전체 컬렉션 읽기)
export async function getPrecomputedStats(): Promise<{ playerStats: PlayerStats[]; heroTiers: HeroTierStat[] } | null> {
  if (isClient && statsCache) return statsCache;
  const d = await getDoc(doc(db, 'stats', 'current'));
  if (!d.exists()) return null;
  const data = d.data();
  const result = {
    playerStats: (data.playerStats ?? []) as PlayerStats[],
    heroTiers: (data.heroTiers ?? []) as HeroTierStat[],
  };
  if (isClient) statsCache = result;
  return result;
}

// 집계 결과를 stats/current에 저장 — 경기/스트리머 변경 시 호출. 실패해도 throws하지 않음
export async function refreshStats(): Promise<void> {
  try {
    const [streamers, matches] = await Promise.all([
      getStreamers({ fresh: true }),
      getMatches(),
    ]);
    const playerStats = calcPlayerStats(streamers, matches);
    const heroTiers = calcHeroTiers(matches);
    // undefined 필드 제거 (Firestore는 undefined 값 거부)
    const clean = (v: unknown) => JSON.parse(JSON.stringify(v));
    await setDoc(doc(db, 'stats', 'current'), {
      playerStats: clean(playerStats),
      heroTiers: clean(heroTiers),
      updatedAt: Timestamp.now(),
    });
    statsCache = null;
  } catch (err) {
    console.error('[refreshStats] 집계 실패:', err);
  }
}

// --- Matches ---

// Firestore는 중첩 배열([[id,hero],...])을 금지하므로 팀을 객체 배열({id,hero})로 직렬화.
type StoredPick = { id: string; hero: string };
function packTeam(team: [string, string][]): StoredPick[] {
  return team.map(([id, hero]) => ({ id, hero }));
}
// 읽기: 객체 배열 → 튜플. 혹시 남아있을 구버전 중첩배열도 호환.
function unpackTeam(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) =>
    Array.isArray(p)
      ? ([p[0], p[1]] as [string, string])
      : ([(p as StoredPick).id, (p as StoredPick).hero] as [string, string]),
  );
}

// Firestore 문서 → Match (팀 복원 + Timestamp 변환)
function toMatch(id: string, data: Record<string, unknown>): Match {
  const rawDur = typeof data.dur === 'string' ? data.dur : undefined;
  return {
    ...data,
    id,
    blueTeam: unpackTeam(data.blueTeam),
    redTeam: unpackTeam(data.redTeam),
    date: (data.date as Timestamp).toDate(),
    createdAt: (data.createdAt as Timestamp).toDate(),
    // 읽기 시 파싱 가능한 dur는 정규화 (DB 마이그레이션 없이 표시·중복 비교 개선)
    ...(rawDur !== undefined ? { dur: normalizeMatchDur(rawDur) } : {}),
  } as Match;
}

export async function getMatches(): Promise<Match[]> {
  if (isClient && matchesCache) return matchesCache;
  const q = query(collection(db, 'matches'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => toMatch(d.id, d.data()));
  if (isClient) matchesCache = list;
  return list;
}

export async function getMatch(id: string): Promise<Match | null> {
  const d = await getDoc(doc(db, 'matches', id));
  if (!d.exists()) return null;
  return toMatch(d.id, d.data());
}

export async function addMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<string> {
  const payload: Record<string, unknown> = {
    ...data,
    // 중첩 배열 금지 → 객체 배열로 직렬화 (읽을 때 unpackTeam으로 복원)
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
    date: Timestamp.fromDate(data.date),
    createdAt: Timestamp.now(),
  };
  // Firestore는 undefined 값을 거부하므로 undefined 필드를 모두 제거
  // (map·dur·note·blueStats·redStats·leftTeam·blueLevel·redLevel 등 선택 필드)
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }

  const ref = await addDoc(collection(db, 'matches'), payload);
  matchesCache = null; // 변경됨 → 다음 조회 시 새로고침
  void refreshStats();
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await deleteDoc(doc(db, 'matches', id));
  matchesCache = null;
  void refreshStats();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await updateDoc(doc(db, 'matches', id), { date: Timestamp.fromDate(date) });
  matchesCache = null;
}

export async function updateMatch(id: string, data: Omit<Match, 'id' | 'createdAt'>): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
    date: Timestamp.fromDate(data.date),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  await updateDoc(doc(db, 'matches', id), payload);
  matchesCache = null;
  void refreshStats();
}

// React 서버 렌더링 내 중복 Firestore 호출 제거 (Suspense 스트리밍 시 사이드바·탭이 동시에 호출해도 1회만 실행)
export const getMatchesCached = cache(getMatches);
