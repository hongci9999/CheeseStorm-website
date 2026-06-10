import type { Match, PlayerStats, Streamer, Tier } from './types';

const MIN_GAMES = 3;

const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: 'S', min: 0.65 },
  { tier: 'A', min: 0.55 },
  { tier: 'B', min: 0.45 },
  { tier: 'C', min: 0.35 },
  { tier: 'D', min: 0 },
];

function calcTier(winRate: number, totalGames: number): Tier {
  if (totalGames < MIN_GAMES) return 'unranked';
  return TIER_THRESHOLDS.find((t) => winRate >= t.min)?.tier ?? 'D';
}

export function calcPlayerStats(streamers: Streamer[], matches: Match[]): PlayerStats[] {
  const statsMap = new Map<string, { wins: number; losses: number; name: string }>();

  for (const s of streamers) {
    statsMap.set(s.id, { wins: 0, losses: 0, name: s.name });
  }

  for (const match of matches) {
    const winners = match.winner === 'blue' ? match.blueTeam : match.redTeam;
    const losers = match.winner === 'blue' ? match.redTeam : match.blueTeam;

    for (const id of winners) {
      const entry = statsMap.get(id);
      if (entry) entry.wins++;
    }
    for (const id of losers) {
      const entry = statsMap.get(id);
      if (entry) entry.losses++;
    }
  }

  return Array.from(statsMap.entries())
    .map(([streamerId, { wins, losses, name }]) => {
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? wins / totalGames : 0;
      return {
        streamerId,
        streamerName: name,
        wins,
        losses,
        totalGames,
        winRate,
        tier: calcTier(winRate, totalGames),
      };
    })
    .sort((a, b) => {
      const tierOrder: Tier[] = ['S', 'A', 'B', 'C', 'D', 'unranked'];
      const diff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
      if (diff !== 0) return diff;
      return b.winRate - a.winRate;
    });
}

export const TIER_COLORS: Record<Tier, string> = {
  S: 'bg-amber-500 text-white',
  A: 'bg-orange-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-blue-500 text-white',
  D: 'bg-slate-500 text-white',
  unranked: 'bg-slate-200 text-slate-600',
};

export const TIER_LABELS: Record<Tier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  unranked: '?',
};
