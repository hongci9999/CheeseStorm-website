import type { Match, PlayerStats, Streamer } from './types';
import { calcPlayerStats } from './tier';
import { participants, outcomeFor, statOf } from './match';

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
    .filter(m => participants(m).some(([id]) => id === streamerId))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, n);
}

// 가장 최근 경기부터 연속된 승 또는 패 (CONTEXT.md 연승/연패)
export function currentStreak(
  matches: Match[],
  streamerId: string,
): { result: 'win' | 'loss'; count: number } | null {
  const played = getRecentMatches(streamerId, matches, Infinity);
  if (played.length === 0) return null;
  const first = outcomeFor(played[0], streamerId);
  if (!first) return null;
  let count = 0;
  for (const m of played) {
    if (outcomeFor(m, streamerId) !== first) break;
    count++;
  }
  return { result: first, count };
}

// 스탯 기록된 경기들의 합산 KDA: (총킬+총어시)/총데스. 데스 0이면 킬+어시.
export function kdaFor(matches: Match[], streamerId: string): number | null {
  let k = 0, a = 0, d = 0, seen = 0;
  for (const m of matches) {
    const s = statOf(m, streamerId);
    if (!s) continue;
    k += s.kills; a += s.assists; d += s.deaths; seen++;
  }
  if (seen === 0) return null;
  return Math.round(((k + a) / Math.max(1, d)) * 100) / 100;
}
