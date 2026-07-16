import { TIER_ORDER } from './tier';
import type {
  CuratedPlacements,
  CuratedTier,
  CuratedTierLists,
  FineRole,
  Streamer,
  Tier,
} from './types';

export const CURATED_TIER_ORDER: CuratedTier[] = ['S', 'A', 'B', 'C', 'D'];

export interface CuratedPlayer {
  streamerId: string;
  streamerName: string;
  profileImageUrl?: string;
  tier: Tier;
  fineRole?: FineRole;
}

export function emptyTierLists(): CuratedTierLists {
  return { S: [], A: [], B: [], C: [], D: [] };
}

// 레거시 placements → 티어별 순서 목록 (이름순 초기 정렬)
export function listsFromPlacements(
  placements: CuratedPlacements,
  streamers: Pick<Streamer, 'id' | 'name'>[],
): CuratedTierLists {
  const lists = emptyTierLists();
  const nameOf = new Map(streamers.map((s) => [s.id, s.name]));
  const byTier: Record<CuratedTier, string[]> = { S: [], A: [], B: [], C: [], D: [] };

  for (const [id, tier] of Object.entries(placements)) {
    if (CURATED_TIER_ORDER.includes(tier)) byTier[tier].push(id);
  }
  for (const tier of CURATED_TIER_ORDER) {
    byTier[tier].sort((a, b) =>
      (nameOf.get(a) ?? '').localeCompare(nameOf.get(b) ?? '', 'ko'),
    );
    lists[tier] = byTier[tier];
  }
  return lists;
}

// 삭제·중복 ID 제거
export function sanitizeLists(
  lists: CuratedTierLists,
  streamerIds: Iterable<string>,
): CuratedTierLists {
  const valid = new Set(streamerIds);
  const seen = new Set<string>();
  const clean = emptyTierLists();
  for (const tier of CURATED_TIER_ORDER) {
    for (const id of lists[tier] ?? []) {
      if (!valid.has(id) || seen.has(id)) continue;
      seen.add(id);
      clean[tier].push(id);
    }
  }
  return clean;
}

// 레거시 호환
export function sanitizePlacements(
  placements: CuratedPlacements,
  streamerIds: Iterable<string>,
): CuratedPlacements {
  const valid = new Set(streamerIds);
  const clean: CuratedPlacements = {};
  for (const [id, tier] of Object.entries(placements)) {
    if (!valid.has(id)) continue;
    if (CURATED_TIER_ORDER.includes(tier)) clean[id] = tier;
  }
  return clean;
}

// fineRoleOf — 스트리머ID별 세분 역할군. 사전집계된 stats/current.playerStats에서 파생(1 read)해
// 전달 — 경기 전체(matches)를 방문자 세션마다 다시 읽는 것을 피하기 위함 (ADR 참고: Firestore 읽기 절감).
export function buildCuratedPlayers(
  streamers: Streamer[],
  lists: CuratedTierLists,
  fineRoleOf: Map<string, FineRole | undefined>,
): CuratedPlayer[] {
  const clean = sanitizeLists(lists, streamers.map((s) => s.id));
  const byId = new Map(streamers.map((s) => [s.id, s]));
  const result: CuratedPlayer[] = [];
  const placed = new Set<string>();

  for (const tier of CURATED_TIER_ORDER) {
    for (const id of clean[tier]) {
      const s = byId.get(id);
      if (!s) continue;
      placed.add(id);
      result.push({
        streamerId: id,
        streamerName: s.name,
        profileImageUrl: s.profileImageUrl,
        tier,
        fineRole: fineRoleOf.get(id),
      });
    }
  }

  const unranked = streamers
    .filter((s) => !placed.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((s) => ({
      streamerId: s.id,
      streamerName: s.name,
      profileImageUrl: s.profileImageUrl,
      tier: 'unranked' as Tier,
      fineRole: fineRoleOf.get(s.id),
    }));

  return [...result, ...unranked];
}

export function groupCuratedByTier(
  players: CuratedPlayer[],
  opts?: { showEmptyTiers?: boolean; includeUnranked?: boolean },
): { tier: Tier; players: CuratedPlayer[] }[] {
  const showEmpty = opts?.showEmptyTiers ?? false;
  const includeUnranked = opts?.includeUnranked ?? true;
  const tiers = includeUnranked
    ? TIER_ORDER
    : TIER_ORDER.filter((t) => t !== 'unranked');

  return tiers
    .map((tier) => ({ tier, players: players.filter((p) => p.tier === tier) }))
    .filter((g) => {
      if (showEmpty && g.tier !== 'unranked') return true;
      if (g.tier === 'S' || g.tier === 'unranked') return true;
      return g.players.length > 0;
    });
}

// 티어 이동·같은 티어 내 순서 변경. insertBeforeId 앞에 삽입, 없으면 맨 뒤.
export function moveStreamer(
  lists: CuratedTierLists,
  streamerId: string,
  targetTier: Tier,
  insertBeforeId?: string,
): CuratedTierLists {
  const next: CuratedTierLists = {
    S: [...lists.S],
    A: [...lists.A],
    B: [...lists.B],
    C: [...lists.C],
    D: [...lists.D],
  };

  for (const tier of CURATED_TIER_ORDER) {
    next[tier] = next[tier].filter((id) => id !== streamerId);
  }

  if (targetTier === 'unranked') return next;

  const list = next[targetTier];
  if (insertBeforeId && insertBeforeId !== streamerId) {
    const idx = list.indexOf(insertBeforeId);
    if (idx >= 0) list.splice(idx, 0, streamerId);
    else list.push(streamerId);
  } else {
    list.push(streamerId);
  }

  return next;
}

export function removeFromLists(lists: CuratedTierLists, streamerId: string): CuratedTierLists {
  const next = emptyTierLists();
  for (const tier of CURATED_TIER_ORDER) {
    next[tier] = lists[tier].filter((id) => id !== streamerId);
  }
  return next;
}
