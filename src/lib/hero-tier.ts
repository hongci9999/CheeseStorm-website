import type { Match, Role, FineRole, Tier } from './types';
import { winningTeam, losingTeam } from './match';
import { roleOfHero, fineRoleOfHero } from './heroes';
import { calcTier, TIER_ORDER } from './tier';

// 영웅 단위 티어 집계 결과 (집계 단위가 스트리머가 아니라 영웅)
export interface HeroTierStat {
  hero: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  recentWinRate?: number;  // 최근 10경기 내 이 영웅 승률 (3판 미만이면 undefined)
  score: number;       // 다양성 페널티 반영 점수 (티어/정렬 산정 기준)
  tier: Tier;          // 스트리머와 동일 기준 (calcTier, 최소 5경기 = MIN_SAMPLE)
  role: Role | null;   // 알 수 없는 영웅은 null
  fineRole: FineRole | null; // 세분 역할군 (암살자 원거리/근접 구별) — 역할 필터용
}

/**
 * 내전 전체 기록에서 영웅별 승률·티어를 집계한다.
 * - 어떤 영웅이 플레이된 모든 경기의 승/패로 승률을 낸다 (스트리머 무관).
 * - 표본 과대평가 방지를 위해 최소 5경기(MIN_SAMPLE) 미만은 unranked.
 * - 반환: 티어 순(S→unranked), 동률이면 승률 내림차순, 그다음 판수 내림차순.
 */
// 사용자 다양성 페널티 — 한두 명이 독점한 영웅은 표본 편향이 크므로 점수를 살짝 깎는다.
// diversity = 사용한 고유 스트리머 수 / 판수 (0~1). 1에 가까울수록 여러 명이 고루 사용.
const DIVERSITY_PENALTY_MAX = 0.05; // 완전 독점(1인) 시 깎는 최대 점수폭 (~티어 1칸 미만)
const DIVERSITY_FULL = 0.8;         // 이 다양성 이상이면 페널티 0 (충분히 고루 사용)

function diversityPenalty(distinctStreamers: number, games: number): number {
  if (games <= 0) return 0;
  const diversity = Math.min(1, distinctStreamers / games);
  if (diversity >= DIVERSITY_FULL) return 0;
  // [0, DIVERSITY_FULL] 구간에서 선형 감소 — 0이면 MAX, DIVERSITY_FULL이면 0
  return DIVERSITY_PENALTY_MAX * (1 - diversity / DIVERSITY_FULL);
}

export function calcHeroTiers(matches: Match[]): HeroTierStat[] {
  const heroMap = new Map<string, { wins: number; losses: number }>();
  const recentMap = new Map<string, ('win' | 'loss')[]>();
  const streamerMap = new Map<string, Set<string>>(); // 영웅별 사용 스트리머 집합

  // 날짜 오름차순 정렬 — 최근 폼 추적이 시간 순서에 의존하므로 먼저 정렬
  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  const bump = (hero: string, key: 'wins' | 'losses') => {
    const name = hero.trim();
    if (!name) return;
    const e = heroMap.get(name) ?? { wins: 0, losses: 0 };
    e[key]++;
    heroMap.set(name, e);
  };

  const addRecent = (hero: string, result: 'win' | 'loss') => {
    const name = hero.trim();
    if (!name) return;
    const arr = recentMap.get(name) ?? [];
    arr.push(result);
    recentMap.set(name, arr);
  };

  const addStreamer = (hero: string, streamerId: string) => {
    const name = hero.trim();
    if (!name || !streamerId) return;
    const set = streamerMap.get(name) ?? new Set<string>();
    set.add(streamerId);
    streamerMap.set(name, set);
  };

  for (const m of sorted) {
    for (const [sid, hero] of winningTeam(m)) {
      bump(hero, 'wins');
      addRecent(hero, 'win');
      addStreamer(hero, sid);
    }
    for (const [sid, hero] of losingTeam(m)) {
      bump(hero, 'losses');
      addRecent(hero, 'loss');
      addStreamer(hero, sid);
    }
  }

  return Array.from(heroMap.entries())
    .map(([hero, { wins, losses }]) => {
      const games = wins + losses;
      const winRate = games > 0 ? wins / games : 0;
      // 베이지안 보정 승률 — 표본이 적을 때 극단값 억제 (사전 확률 50%, 강도 3)
      const bayesWinRate = (wins + 1.5) / (games + 3);
      // 다양성 페널티 적용 점수 — 소수 독점 영웅은 티어를 살짝 내린다
      const distinctStreamers = streamerMap.get(hero)?.size ?? 0;
      const score = Math.max(0, bayesWinRate - diversityPenalty(distinctStreamers, games));

      const recentArr = recentMap.get(hero) ?? [];
      const recentSlice = recentArr.slice(-10);
      const recentWinRate = recentSlice.length >= 3
        ? recentSlice.filter(r => r === 'win').length / recentSlice.length
        : undefined;

      return {
        hero, wins, losses, games, winRate, recentWinRate, score,
        tier: calcTier(score, games),
        role: roleOfHero(hero),
        fineRole: fineRoleOfHero(hero),
      };
    })
    .sort((a, b) => {
      const diff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      if (diff !== 0) return diff;
      // 티어 내 정렬도 페널티 반영 점수 기준
      if (b.score !== a.score) return b.score - a.score;
      if (b.games !== a.games) return b.games - a.games;
      return a.hero.localeCompare(b.hero, 'ko');
    });
}

// 티어별로 영웅을 묶는다 (S~D는 빈 티어도 표시, unranked는 있을 때만).
export function groupHeroesByTier(
  stats: HeroTierStat[],
): { tier: Tier; heroes: HeroTierStat[] }[] {
  return TIER_ORDER
    .map((tier) => ({ tier, heroes: stats.filter((s) => s.tier === tier) }))
    .filter((g) => g.tier !== 'unranked' || g.heroes.length > 0);
}
