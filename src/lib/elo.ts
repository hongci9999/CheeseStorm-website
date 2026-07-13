import type { Match } from './types';
import { winningTeam } from './match';

function calcExpectedWinRate(teamElo: number, oppTeamElo: number): number {
  const diff = oppTeamElo - teamElo;
  return 1 / (1 + Math.pow(10, diff / 400));
}

export function calcAllElos(matches: Match[]): Map<string, number> {
  const playerElos = new Map<string, number>();
  const playerGameCounts = new Map<string, number>(); // 각 선수의 누적 게임 수

  // 모든 선수 초기 Elo = 1500
  const allPlayers = new Set<string>();
  for (const m of matches) {
    for (const [id] of [...m.blueTeam, ...m.redTeam]) {
      allPlayers.add(id);
      if (!playerElos.has(id)) {
        playerElos.set(id, 1500);
        playerGameCounts.set(id, 0);
      }
    }
  }

  // 시간순 정렬 (오래된 경기부터)
  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  const K = 32; // 표준 K-factor

  for (const match of sorted) {
    const isBlueWon = winningTeam(match) === match.blueTeam;
    const blueTeam = match.blueTeam;
    const redTeam = match.redTeam;

    // 팀 평균 Elo 계산
    const blueElos = blueTeam.map(([id]) => playerElos.get(id) || 1500);
    const redElos = redTeam.map(([id]) => playerElos.get(id) || 1500);

    const blueTeamElo = blueElos.reduce((a, b) => a + b, 0) / blueElos.length;
    const redTeamElo = redElos.reduce((a, b) => a + b, 0) / redElos.length;

    // 기대 승률
    const blueExpected = calcExpectedWinRate(blueTeamElo, redTeamElo);
    const redExpected = calcExpectedWinRate(redTeamElo, blueTeamElo);

    // 개인 Elo 업데이트
    for (const [id] of blueTeam) {
      const currentElo = playerElos.get(id) || 1500;
      const gameCount = (playerGameCounts.get(id) ?? 0) + 1;
      const actual = isBlueWon ? 1 : 0;

      // 보정 상수 M (11판부터 적용)
      let M = 1;
      if (gameCount >= 11) {
        const isAce = currentElo > blueTeamElo;
        if (isAce) {
          M = 0.8; // 에이스: 승리/패배 모두 0.8
        } else {
          M = actual === 1 ? 0.8 : 1.2; // 버스: 승리 0.8, 패배 1.2
        }
      }

      const delta = K * (actual - blueExpected) * M;
      playerElos.set(id, currentElo + delta);
      playerGameCounts.set(id, gameCount);
    }

    for (const [id] of redTeam) {
      const currentElo = playerElos.get(id) || 1500;
      const gameCount = (playerGameCounts.get(id) ?? 0) + 1;
      const actual = isBlueWon ? 0 : 1;

      // 보정 상수 M (11판부터 적용)
      let M = 1;
      if (gameCount >= 11) {
        const isAce = currentElo > redTeamElo;
        if (isAce) {
          M = 0.8; // 에이스: 승리/패배 모두 0.8
        } else {
          M = actual === 1 ? 0.8 : 1.2; // 버스: 승리 0.8, 패배 1.2
        }
      }

      const delta = K * (actual - redExpected) * M;
      playerElos.set(id, currentElo + delta);
      playerGameCounts.set(id, gameCount);
    }
  }

  return playerElos;
}
