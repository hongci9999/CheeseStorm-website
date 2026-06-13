import type { Match, Streamer } from './types';
import { outcomeFor } from './match';

// 시너지/천적 집계 최소 공동 출현 경기 수 (티어 MIN_SAMPLE과 별개)
const MIN_RELATION = 3;

// 시너지 팀원 = 같은 팀으로 함께 뛴 경기의 승률이 높은 스트리머 (CONTEXT.md)
export interface SynergyStat {
  streamerId: string;
  streamerName: string;
  games: number;     // 같은 팀 공동 출현 수
  wins: number;      // 함께 이긴 경기
  winRate: number;   // wins / games
}

// 천적 = 적팀으로 만났을 때 내가 진 비율이 높은 스트리머 (CONTEXT.md)
export interface NemesisStat {
  streamerId: string;
  streamerName: string;
  games: number;     // 상대 팀 공동 출현 수
  losses: number;    // 그 상대를 만나 내가 진 경기
  lossRate: number;  // losses / games
}

/**
 * 한 스트리머 기준 시너지 팀원·천적을 한 번의 순회로 집계한다.
 * - 상대와 최소 3경기(MIN_SAMPLE) 공동 출현을 충족한 경우만 포함.
 * - synergy: 승률 내림차순, nemesis: 패율 내림차순 (동률이면 판수→이름).
 */
export function computeRelations(
  streamerId: string,
  streamers: Streamer[],
  matches: Match[],
): { synergy: SynergyStat[]; nemesis: NemesisStat[] } {
  const nameOf = new Map(streamers.map((s) => [s.id, s.name]));
  const teammate = new Map<string, { games: number; wins: number }>();
  const opponent = new Map<string, { games: number; losses: number }>();

  for (const m of matches) {
    const onBlue = m.blueTeam.some(([id]) => id === streamerId);
    const onRed = m.redTeam.some(([id]) => id === streamerId);
    if (!onBlue && !onRed) continue;

    const outcome = outcomeFor(m, streamerId);
    if (!outcome) continue;
    const won = outcome === 'win';

    const myTeam = onBlue ? m.blueTeam : m.redTeam;
    const otherTeam = onBlue ? m.redTeam : m.blueTeam;

    for (const [id] of myTeam) {
      if (id === streamerId) continue;
      const e = teammate.get(id) ?? { games: 0, wins: 0 };
      e.games++;
      if (won) e.wins++;
      teammate.set(id, e);
    }
    for (const [id] of otherTeam) {
      const e = opponent.get(id) ?? { games: 0, losses: 0 };
      e.games++;
      if (!won) e.losses++;
      opponent.set(id, e);
    }
  }

  const synergy: SynergyStat[] = Array.from(teammate.entries())
    .filter(([, e]) => e.games >= MIN_RELATION)
    .map(([id, e]) => ({
      streamerId: id,
      streamerName: nameOf.get(id) ?? id,
      games: e.games,
      wins: e.wins,
      winRate: e.wins / e.games,
    }))
    .sort((a, b) =>
      b.winRate - a.winRate || b.games - a.games || a.streamerName.localeCompare(b.streamerName, 'ko'),
    );

  const nemesis: NemesisStat[] = Array.from(opponent.entries())
    .filter(([, e]) => e.games >= MIN_RELATION)
    .map(([id, e]) => ({
      streamerId: id,
      streamerName: nameOf.get(id) ?? id,
      games: e.games,
      losses: e.losses,
      lossRate: e.losses / e.games,
    }))
    .sort((a, b) =>
      b.lossRate - a.lossRate || b.games - a.games || a.streamerName.localeCompare(b.streamerName, 'ko'),
    );

  return { synergy, nemesis };
}
