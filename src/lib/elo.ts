import type { Match } from './types';
import { winningTeam } from './match';

// 표준 Elo 기대승률: 1 / (1 + 10^((상대-나)/400))
function calcExpectedWinRate(teamElo: number, oppTeamElo: number): number {
  const diff = oppTeamElo - teamElo;
  return 1 / (1 + Math.pow(10, diff / 400));
}

export interface EloMatchDetail {
  matchId: string;
  date: Date;
  teamElo: number;
  oppTeamElo: number;
  expectedWinRate: number;
  actual: 0 | 1;
  delta: number;
  eloAfter: number;
}

export interface EloDetail {
  streamerId: string;
  finalElo: number;
  matches: EloMatchDetail[];
}

const K = 32; // 표준 K-factor
const INITIAL_ELO = 1500;

// 순수 표준 Elo — 팀 평균 vs 팀 평균, 팀원 전원 동일 델타.
// 에이스/버스 개인 보정(M)은 제로섬을 깨고 다판수 선수를 체계적으로 깎아
// 실데이터 검증 후 제거함 (승률 51% 68판 선수가 0승 6패 선수보다 낮아지는 역전 발생).
// 개인 기여도는 Elo 자기교정으로 장기 수렴: 과대평가된 선수는 팀 기대승률을
// 부풀려 기대보다 자주 지므로 자연히 하락한다.
export function calcAllElos(matches: Match[]): Map<string, number> {
  const playerElos = new Map<string, number>();

  for (const m of matches) {
    for (const [id] of [...m.blueTeam, ...m.redTeam]) {
      if (!playerElos.has(id)) playerElos.set(id, INITIAL_ELO);
    }
  }

  // 시간순 정렬 (오래된 경기부터)
  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const match of sorted) {
    const isBlueWon = winningTeam(match) === match.blueTeam;

    // 팀 평균 Elo
    const blueElos = match.blueTeam.map(([id]) => playerElos.get(id) ?? INITIAL_ELO);
    const redElos = match.redTeam.map(([id]) => playerElos.get(id) ?? INITIAL_ELO);
    const blueTeamElo = blueElos.reduce((a, b) => a + b, 0) / blueElos.length;
    const redTeamElo = redElos.reduce((a, b) => a + b, 0) / redElos.length;

    const blueExpected = calcExpectedWinRate(blueTeamElo, redTeamElo);
    const redExpected = 1 - blueExpected;

    const blueDelta = K * ((isBlueWon ? 1 : 0) - blueExpected);
    const redDelta = K * ((isBlueWon ? 0 : 1) - redExpected);

    for (const [id] of match.blueTeam) {
      playerElos.set(id, (playerElos.get(id) ?? INITIAL_ELO) + blueDelta);
    }
    for (const [id] of match.redTeam) {
      playerElos.set(id, (playerElos.get(id) ?? INITIAL_ELO) + redDelta);
    }
  }

  return playerElos;
}

// calcAllElos와 동일 로직 + 경기별 계산 과정 기록 (UI 상세 패널용)
export function calcAllElosWithDetails(matches: Match[]): EloDetail[] {
  const playerElos = new Map<string, number>();
  const playerDetails = new Map<string, EloMatchDetail[]>();

  for (const m of matches) {
    for (const [id] of [...m.blueTeam, ...m.redTeam]) {
      if (!playerElos.has(id)) {
        playerElos.set(id, INITIAL_ELO);
        playerDetails.set(id, []);
      }
    }
  }

  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const match of sorted) {
    const isBlueWon = winningTeam(match) === match.blueTeam;

    const blueElos = match.blueTeam.map(([id]) => playerElos.get(id) ?? INITIAL_ELO);
    const redElos = match.redTeam.map(([id]) => playerElos.get(id) ?? INITIAL_ELO);
    const blueTeamElo = blueElos.reduce((a, b) => a + b, 0) / blueElos.length;
    const redTeamElo = redElos.reduce((a, b) => a + b, 0) / redElos.length;

    const blueExpected = calcExpectedWinRate(blueTeamElo, redTeamElo);
    const redExpected = 1 - blueExpected;

    for (const [team, teamElo, oppTeamElo, expected, actual] of [
      [match.blueTeam, blueTeamElo, redTeamElo, blueExpected, isBlueWon ? 1 : 0],
      [match.redTeam, redTeamElo, blueTeamElo, redExpected, isBlueWon ? 0 : 1],
    ] as const) {
      const delta = K * (actual - expected);
      for (const [id] of team) {
        const newElo = (playerElos.get(id) ?? INITIAL_ELO) + delta;
        playerElos.set(id, newElo);
        playerDetails.get(id)!.push({
          matchId: match.id,
          date: match.date,
          teamElo,
          oppTeamElo,
          expectedWinRate: expected,
          actual,
          delta,
          eloAfter: newElo,
        });
      }
    }
  }

  return Array.from(playerElos.keys()).map((streamerId) => ({
    streamerId,
    finalElo: playerElos.get(streamerId) ?? INITIAL_ELO,
    matches: playerDetails.get(streamerId) ?? [],
  }));
}
