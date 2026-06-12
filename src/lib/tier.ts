import type { HeroStat, Match, PlayerStats, Streamer, Tier } from './types';
import { winningTeam, losingTeam } from './match';
import { deriveRole } from './heroes';
import { MIN_SAMPLE } from './sample';

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

// 티어 정렬·그룹화 공통 순서
export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'unranked'];

export function calcPlayerStats(streamers: Streamer[], matches: Match[]): PlayerStats[] {
  const statsMap = new Map<
    string,
    { wins: number; losses: number; name: string; img?: string; role?: import('./types').Role; heroes: Map<string, { wins: number; losses: number }> }
  >();

  for (const s of streamers) {
    // 롤은 수동 입력이 아닌 내전 기록에서 파생 (CONTEXT.md 롤 참조)
    statsMap.set(s.id, {
      wins: 0, losses: 0, name: s.name, img: s.profileImageUrl,
      role: deriveRole(matches, s.id),
      heroes: new Map(),
    });
  }

  for (const match of matches) {
    const winners = winningTeam(match);
    const losers  = losingTeam(match);

    for (const [id, hero] of winners) {
      const entry = statsMap.get(id);
      if (!entry) continue;
      entry.wins++;
      const h = entry.heroes.get(hero) ?? { wins: 0, losses: 0 };
      h.wins++;
      entry.heroes.set(hero, h);
    }

    for (const [id, hero] of losers) {
      const entry = statsMap.get(id);
      if (!entry) continue;
      entry.losses++;
      const h = entry.heroes.get(hero) ?? { wins: 0, losses: 0 };
      h.losses++;
      entry.heroes.set(hero, h);
    }
  }

  return Array.from(statsMap.entries())
    .map(([streamerId, { wins, losses, name, img, role, heroes }]) => {
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? wins / totalGames : 0;

      const heroStats: HeroStat[] = Array.from(heroes.entries())
        .map(([hero, s]) => ({ hero, wins: s.wins, losses: s.losses }))
        .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

      return { streamerId, streamerName: name, profileImageUrl: img, role, wins, losses, totalGames, winRate, tier: calcTier(winRate, totalGames), heroStats };
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
