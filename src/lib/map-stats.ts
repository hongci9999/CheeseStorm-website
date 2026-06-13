import type { Match } from './types';
import { outcomeFor } from './match';

// 맵별 승률 집계 최소 경기 수 (티어 MIN_SAMPLE과 별개)
const MIN_MAP_SAMPLE = 3;

// 맵별 승률 (CONTEXT.md 맵별 승률) — 인게임 진영 승률과는 별개.
export interface MapWinRate {
  map: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number | null; // 최소 3경기(MIN_SAMPLE) 충족 시 계산, 미만이면 null = 데이터 부족
}

/**
 * 한 스트리머의 맵별 승/패·승률을 집계한다.
 * - 맵 미기록 경기·미참가 경기는 제외.
 * - 맵당 3경기 미만은 winRate=null (데이터 부족)로 표시한다.
 * - 반환: 충족 맵 먼저(승률 내림차순) → 미충족 맵(판수 내림차순) → 맵명.
 */
export function mapWinRates(streamerId: string, matches: Match[]): MapWinRate[] {
  const byMap = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    const mapName = m.map?.trim();
    if (!mapName) continue; // 맵 미기록 제외

    const outcome = outcomeFor(m, streamerId);
    if (!outcome) continue; // 미참가 제외

    const e = byMap.get(mapName) ?? { wins: 0, losses: 0 };
    if (outcome === 'win') e.wins++;
    else e.losses++;
    byMap.set(mapName, e);
  }

  return Array.from(byMap.entries())
    .map(([map, e]) => {
      const games = e.wins + e.losses;
      const sufficient = games >= MIN_MAP_SAMPLE;
      return { map, games, wins: e.wins, losses: e.losses, winRate: sufficient ? e.wins / games : null };
    })
    .sort((a, b) => {
      const aOk = a.winRate !== null;
      const bOk = b.winRate !== null;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (aOk && bOk && b.winRate! !== a.winRate!) return b.winRate! - a.winRate!;
      if (b.games !== a.games) return b.games - a.games;
      return a.map.localeCompare(b.map, 'ko');
    });
}
