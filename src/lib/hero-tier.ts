import type { Match, Role, FineRole, Tier } from './types';
import { winningTeam, losingTeam } from './match';
import { roleOfHero, fineRoleOfHero } from './heroes';
import { calcTier, calcBayesianWinRate, TIER_ORDER } from './tier';

// 영웅 단위 티어 집계 결과 (집계 단위가 스트리머가 아니라 영웅)
export interface HeroTierStat {
  hero: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  recentWinRate?: number;  // 이 영웅이 등장한 최근 10판 승률 (3판 미만이면 undefined)
  score: number;       // 집중도 반영 베이지안 승률 (티어/정렬 산정 기준)
  tier: Tier;          // 스트리머와 동일 기준 (calcTier, 최소 5경기 = MIN_SAMPLE)
  role: Role | null;   // 알 수 없는 영웅은 null
  fineRole: FineRole | null; // 세분 역할군 (암살자 원거리/근접 구별) — 역할 필터용
}

// 집중도 비례 사전 강도 — 한두 명이 독점한 영웅은 표본의 증거력이 약하므로
// 승률을 50% 쪽으로 더 강하게 수축시킨다 (좋은 쪽·나쁜 쪽 모두 과장 억제).
// top1Share = 최다 사용 스트리머의 판수 / 전체 판수 (독점 1.0 ~ 고른 사용 → 0).
const PRIOR_BASE = 3;     // 기본 사전 강도 (가상 3경기, 승률 50%)
const PRIOR_MONOPOLY = 5; // 완전 독점(top1Share=1) 시 추가되는 사전 강도

function priorStrength(top1Share: number): number {
  return PRIOR_BASE + PRIOR_MONOPOLY * top1Share;
}

/**
 * 내전 전체 기록에서 영웅별 승률·티어를 집계한다.
 * - 어떤 영웅이 플레이된 모든 경기의 승/패로 승률을 낸다 (스트리머 무관).
 * - 표본 과대평가 방지를 위해 최소 5경기(MIN_SAMPLE) 미만은 unranked.
 * - 소수 독점 영웅은 사전 강도를 키워 극단 승률을 억제한다 (priorStrength).
 * - 반환: 티어 순(S→unranked), 동률이면 score 내림차순, 그다음 판수 내림차순.
 */
export function calcHeroTiers(matches: Match[]): HeroTierStat[] {
  const heroMap = new Map<string, { wins: number; losses: number }>();
  const recentMap = new Map<string, ('win' | 'loss')[]>();
  const streamerMap = new Map<string, Map<string, number>>(); // 영웅별 스트리머 사용 판수

  // 날짜 오름차순 정렬 — 최근 폼 추적이 시간 순서에 의존하므로 먼저 정렬
  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime());

  const record = (hero: string, sid: string, result: 'win' | 'loss') => {
    const name = hero.trim();
    if (!name) return;

    const e = heroMap.get(name) ?? { wins: 0, losses: 0 };
    e[result === 'win' ? 'wins' : 'losses']++;
    heroMap.set(name, e);

    const arr = recentMap.get(name) ?? [];
    arr.push(result);
    recentMap.set(name, arr);

    if (sid) {
      const counts = streamerMap.get(name) ?? new Map<string, number>();
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
      streamerMap.set(name, counts);
    }
  };

  for (const m of sorted) {
    for (const [sid, hero] of winningTeam(m)) record(hero, sid, 'win');
    for (const [sid, hero] of losingTeam(m)) record(hero, sid, 'loss');
  }

  return Array.from(heroMap.entries())
    .map(([hero, { wins, losses }]) => {
      const games = wins + losses;
      const winRate = games > 0 ? wins / games : 0;

      // 최다 사용자 점유율 → 사전 강도 → 집중도 반영 베이지안 승률
      const counts = streamerMap.get(hero);
      const top1Games = counts ? Math.max(...counts.values()) : 0;
      const top1Share = games > 0 ? top1Games / games : 0;
      const score = calcBayesianWinRate(wins, games, priorStrength(top1Share));

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
      // 티어 내 정렬도 집중도 반영 점수 기준
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
