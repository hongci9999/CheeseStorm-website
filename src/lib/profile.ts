import type { Match, PlayerStats, Streamer } from './types';
import { calcPlayerStats } from './tier';

export function getStreamerProfile(
  streamerId: string,
  streamers: Streamer[],
  matches: Match[],
): PlayerStats | null {
  const all = calcPlayerStats(streamers, matches);
  return all.find(p => p.streamerId === streamerId) ?? null;
}

export function getRecentMatches(
  streamerId: string,
  matches: Match[],
  n = 6,
): Match[] {
  return matches
    .filter(m =>
      m.blueTeam.some(([id]) => id === streamerId) ||
      m.redTeam.some(([id]) => id === streamerId),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, n);
}
