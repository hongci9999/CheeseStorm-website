import type { Match } from './types';
import { winningTeam } from './match';

function calcExpectedWinRate(teamElo: number, oppTeamElo: number): number {
  const diff = oppTeamElo - teamElo;
  return 1 / (1 + Math.pow(10, diff / 400));
}

export function calcAllElos(matches: Match[]): Map<string, number> {
  const playerElos = new Map<string, number>();
  const playerGames = new Map<string, number>();

  // 모든 선수 초기 Elo = 1500, 판수 = 0
  const allPlayers = new Set<string>();
  for (const m of matches) {
    for (const [id] of [...m.blueTeam, ...m.redTeam]) {
      allPlayers.add(id);
      if (!playerElos.has(id)) {
        playerElos.set(id, 1500);
        playerGames.set(id, 0);
      }
    }
  }

  // 시간순 정렬 (오래된 경기부터)
  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

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
      const games = playerGames.get(id) || 0;

      // 판수별 K-factor 조정
      let K = 32; // 기본값 (20판 이상)
      if (games < 10) K = 48; // 10판 미만: 변화 크다
      else if (games < 20) K = 40; // 10~20판: 중간

      const actual = isBlueWon ? 1 : 0;
      const delta = K * (actual - blueExpected);
      playerElos.set(id, currentElo + delta);
      playerGames.set(id, games + 1);
    }

    for (const [id] of redTeam) {
      const currentElo = playerElos.get(id) || 1500;
      const games = playerGames.get(id) || 0;

      // 판수별 K-factor 조정
      let K = 32; // 기본값 (20판 이상)
      if (games < 10) K = 48; // 10판 미만: 변화 크다
      else if (games < 20) K = 40; // 10~20판: 중간

      const actual = isBlueWon ? 0 : 1;
      const delta = K * (actual - redExpected);
      playerElos.set(id, currentElo + delta);
      playerGames.set(id, games + 1);
    }
  }

  return playerElos;
}
