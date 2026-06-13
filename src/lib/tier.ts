import type { HeroStat, Match, PlayerStats, Streamer, Tier } from './types';
import { winningTeam, losingTeam } from './match';
import { deriveRole, deriveFineRole } from './heroes';
import { MIN_SAMPLE } from './sample';
import { calcAllStatScores, statAlpha, statToWinRate } from './stat-score';

const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: 'S', min: 0.65 },
  { tier: 'A', min: 0.55 },
  { tier: 'B', min: 0.45 },
  { tier: 'C', min: 0.35 },
  { tier: 'D', min: 0 },
];

// 승률 → 티어. 표본 임계(MIN_SAMPLE) 미만은 unranked.
// 스트리머·영웅 티어가 동일 기준을 쓰도록 단일 소스로 export (CONTEXT.md 티어)
export function calcTier(winRate: number, totalGames: number): Tier {
  if (totalGames < MIN_SAMPLE) return 'unranked';
  return TIER_THRESHOLDS.find((t) => winRate >= t.min)?.tier ?? 'D';
}

// 베이지안 승률: 소규모 표본의 극단값을 50%로 당겨줌
// prior = 50%, weight = 3경기. (wins+1.5)/(total+3)
export function calcBayesianWinRate(wins: number, total: number): number {
  return (wins + 1.5) / (total + 3);
}

// 티어 정렬·그룹화 공통 순서
export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'unranked'];

export function calcPlayerStats(streamers: Streamer[], matches: Match[]): PlayerStats[] {
  const statsMap = new Map<
    string,
    { wins: number; losses: number; name: string; img?: string; role?: import('./types').Role; fineRole?: import('./types').FineRole; heroes: Map<string, { wins: number; losses: number }> }
  >();

  // 스트리머별 경기 결과 타임라인 (날짜 오름차순)
  const timelineMap = new Map<string, ('win' | 'loss')[]>();

  for (const s of streamers) {
    // 롤은 수동 입력이 아닌 내전 기록에서 파생 (CONTEXT.md 롤 참조)
    statsMap.set(s.id, {
      wins: 0, losses: 0, name: s.name, img: s.profileImageUrl,
      role: deriveRole(matches, s.id),
      fineRole: deriveFineRole(matches, s.id),
      heroes: new Map(),
    });
    timelineMap.set(s.id, []);
  }

  // 날짜 오름차순 정렬 후 처리 (연승/연패 및 최근 승률 계산용)
  const sortedMatches = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const match of sortedMatches) {
    const winners = winningTeam(match);
    const losers  = losingTeam(match);

    for (const [id, hero] of winners) {
      const entry = statsMap.get(id);
      if (!entry) continue;
      entry.wins++;
      const h = entry.heroes.get(hero) ?? { wins: 0, losses: 0 };
      h.wins++;
      entry.heroes.set(hero, h);
      timelineMap.get(id)?.push('win');
    }

    for (const [id, hero] of losers) {
      const entry = statsMap.get(id);
      if (!entry) continue;
      entry.losses++;
      const h = entry.heroes.get(hero) ?? { wins: 0, losses: 0 };
      h.losses++;
      entry.heroes.set(hero, h);
      timelineMap.get(id)?.push('loss');
    }
  }

  // 전체 스트리머 스탯 점수 (역할 내 정규화 — 한 번에 계산)
  const statScores = calcAllStatScores(matches, Array.from(statsMap.keys()));

  return Array.from(statsMap.entries())
    .map(([streamerId, { wins, losses, name, img, role, fineRole, heroes }]) => {
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? wins / totalGames : 0;

      const heroStats: HeroStat[] = Array.from(heroes.entries())
        .map(([hero, s]) => ({ hero, wins: s.wins, losses: s.losses }))
        .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

      const timeline = timelineMap.get(streamerId) ?? [];

      // 최근 5경기 승률 (5경기 미만이면 전체 승률 사용)
      const recentSlice = timeline.slice(-5);
      const recentWinRate = recentSlice.length > 0
        ? recentSlice.filter(r => r === 'win').length / recentSlice.length
        : winRate;

      // 연승/연패: 타임라인 끝에서 같은 결과가 연속된 횟수
      let streak = 0;
      if (timeline.length > 0) {
        const last = timeline[timeline.length - 1];
        for (let i = timeline.length - 1; i >= 0; i--) {
          if (timeline[i] === last) streak += (last === 'win' ? 1 : -1);
          else break;
        }
      }

      const topHero = heroStats[0]?.hero;

      // 승률 + 스탯 혼합 점수 → 티어 (docs/tierlist-logic.md)
      const { score: statScore, coverage: statCoverage } = statScores.get(streamerId) ?? { score: 0.5, coverage: 0 };
      const alpha     = statAlpha(statCoverage);
      const statWR    = statToWinRate(statScore);
      const bayesWR   = calcBayesianWinRate(wins, totalGames);
      const finalScore = alpha * bayesWR + (1 - alpha) * statWR;

      return {
        streamerId,
        streamerName: name,
        profileImageUrl: img,
        role,
        fineRole,
        wins,
        losses,
        totalGames,
        winRate,
        tier: calcTier(finalScore, totalGames),
        heroStats,
        recentWinRate,
        streak,
        topHero,
        statCoverage,
      };
    })
    .sort((a, b) => {
      const diff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      if (diff !== 0) return diff;
      return b.winRate - a.winRate;
    });
}

export function groupStatsByTier(
  stats: PlayerStats[],
): { tier: Tier | 'unranked'; players: PlayerStats[] }[] {
  return TIER_ORDER
    .map((tier) => ({ tier, players: stats.filter((s) => s.tier === tier) }))
    .filter((g) => g.players.length > 0);
}


export const TIER_LABELS: Record<Tier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  unranked: '?',
};
