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

// 내전은 의도적으로 밸런싱되어 팀 평균 Elo 차이가 작다 → 기대승률이 30~70%에 갇혀
// 표준 델타(K·(actual−E))가 ±32의 절반 남짓밖에 안 쓰인다.
// 실제로 도달 가능한 기대승률 범위(25~75%)를 델타 전 구간(±K)에 대응시키기 위해
// 델타를 1/0.75배 스케일하고 ±K로 클램프한다.
// 양 팀 (actual−E)의 부호만 반대·크기는 같으므로 스케일·클램프 후에도 제로섬 유지.
const MAX_SWING_EXPECTED = 0.25; // 기대승률 25%(또는 75%)에서 델타가 ±K에 도달
const DELTA_SCALE = 1 / (1 - MAX_SWING_EXPECTED);

export function calcDelta(actual: 0 | 1, expected: number): number {
  const raw = K * (actual - expected) * DELTA_SCALE;
  return Math.max(-K, Math.min(K, raw));
}

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

    const blueDelta = calcDelta(isBlueWon ? 1 : 0, blueExpected);
    const redDelta = calcDelta(isBlueWon ? 0 : 1, redExpected);

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
      const delta = calcDelta(actual, expected);
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
