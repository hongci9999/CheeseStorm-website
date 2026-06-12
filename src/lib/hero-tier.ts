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
  tier: Tier;          // 스트리머와 동일 기준 (calcTier, 최소 3경기)
  role: Role | null;   // 알 수 없는 영웅은 null
  fineRole: FineRole | null; // 세분 역할군 (암살자 원거리/근접 구별) — 역할 필터용
}

/**
 * 내전 전체 기록에서 영웅별 승률·티어를 집계한다.
 * - 어떤 영웅이 플레이된 모든 경기의 승/패로 승률을 낸다 (스트리머 무관).
 * - 표본 과대평가 방지를 위해 최소 3경기(MIN_SAMPLE) 미만은 unranked.
 * - 반환: 티어 순(S→unranked), 동률이면 승률 내림차순, 그다음 판수 내림차순.
 */
export function calcHeroTiers(matches: Match[]): HeroTierStat[] {
  const heroMap = new Map<string, { wins: number; losses: number }>();

  const bump = (hero: string, key: 'wins' | 'losses') => {
    const name = hero.trim();
    if (!name) return;
    const e = heroMap.get(name) ?? { wins: 0, losses: 0 };
    e[key]++;
    heroMap.set(name, e);
  };

  for (const m of matches) {
    for (const [, hero] of winningTeam(m)) bump(hero, 'wins');
    for (const [, hero] of losingTeam(m)) bump(hero, 'losses');
  }

  return Array.from(heroMap.entries())
    .map(([hero, { wins, losses }]) => {
      const games = wins + losses;
      const winRate = games > 0 ? wins / games : 0;
      return { hero, wins, losses, games, winRate, tier: calcTier(winRate, games), role: roleOfHero(hero), fineRole: fineRoleOfHero(hero) };
    })
    .sort((a, b) => {
      const diff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      if (diff !== 0) return diff;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.games !== a.games) return b.games - a.games;
      return a.hero.localeCompare(b.hero, 'ko');
    });
}

// 티어별로 영웅을 묶는다 (빈 티어 제외).
export function groupHeroesByTier(
  stats: HeroTierStat[],
): { tier: Tier; heroes: HeroTierStat[] }[] {
  return TIER_ORDER
    .map((tier) => ({ tier, heroes: stats.filter((s) => s.tier === tier) }))
    .filter((g) => g.heroes.length > 0);
}
