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

const INITIAL_ELO = 1500;

// 승리 팀 증가폭을 기대승률의 감소 로지스틱(S자 곡선)으로 매핑한다.
// 내전은 밸런싱돼 기대승률이 30~70%에 몰리므로 그 구간을 가파르게,
// 바깥은 완만하게(포화) 만들어 이변에 크게·강팀 압승에 작게 반응시킨다.
//   기대승률 50%(대등) 승 → +20
//   기대승률 30%(언더독) 승 → +35,  70%(강팀) 승 → +5
//   30/70% 바깥은 같은 방향으로 계속 이동하되 각각 40·0에 완만히 수렴
const EQUAL_DELTA = 20; // 대등(50%)일 때 승자 증가폭 = 곡선 중앙값
const MAX_DELTA = 2 * EQUAL_DELTA; // 완전 이변(기대승률 0%)의 점근 상한 = 40
// MAX_DELTA / (1 + e^{k·(0.3−0.5)}) = 35 을 만족하는 기울기 → k = 5·ln7 ≈ 9.73
const STEEPNESS = 5 * Math.log(7);

// 승리 팀 증가폭 g(p): p=승리 팀 기대승률. 항상 (0, MAX_DELTA) 사이 양수.
function winnerGain(p: number): number {
  return MAX_DELTA / (1 + Math.exp(STEEPNESS * (p - 0.5)));
}

// 승자는 +g(E_승), 패자는 −g(E_승)=−g(1−E_패) → 크기 동일·부호 반대로 제로섬 유지.
export function calcDelta(actual: 0 | 1, expected: number): number {
  return actual === 1 ? winnerGain(expected) : -winnerGain(1 - expected);
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
  // date는 시각 없는 자정값이라 같은 날 경기끼리 동점 → createdAt(입력 순)으로 확정.
  // Elo는 경로 의존적이므로 이 타이브레이커가 없으면 최종 레이팅이 문서 ID 순에 좌우된다.
  const sorted = [...matches].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  );

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

  // date는 시각 없는 자정값이라 같은 날 경기끼리 동점 → createdAt(입력 순)으로 확정.
  // Elo는 경로 의존적이므로 이 타이브레이커가 없으면 최종 레이팅이 문서 ID 순에 좌우된다.
  const sorted = [...matches].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  );

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
