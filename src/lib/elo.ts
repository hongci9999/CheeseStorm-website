import type { Match, PlayerStats } from './types';
import { winningTeam, losingTeam, statOf } from './match';

interface PerformanceData {
  kda: number;
  dmg: number; // heroDmg + siegeDmg
}

function calcPerformanceScore(
  stats: Record<string, PerformanceData[]>,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [playerId, playerStats] of Object.entries(stats)) {
    if (playerStats.length === 0) continue;

    const avgKda = playerStats.reduce((s, x) => s + x.kda, 0) / playerStats.length;
    const avgDmg = playerStats.reduce((s, x) => s + x.dmg, 0) / playerStats.length;

    // 절대값 기준 정규화 (경기 추가/삭제해도 변하지 않음)
    const kdaNorm = Math.min(1, Math.max(0, avgKda / 10)); // KDA: 0~10 → 0~1
    const dmgNorm = Math.min(1, Math.max(0, avgDmg / 5000)); // Dmg: 0~5000 → 0~1

    const score = 0.4 * kdaNorm + 0.6 * dmgNorm;
    scores.set(playerId, score);
  }

  return scores;
}

function calcTeamElo(playerElos: number[]): number {
  return playerElos.length > 0
    ? playerElos.reduce((a, b) => a + b, 0) / playerElos.length
    : 1500;
}

function calcExpectedWinRate(teamElo: number, oppTeamElo: number): number {
  const diff = oppTeamElo - teamElo;
  return 1 / (1 + Math.pow(10, diff / 400));
}

function calcEloDelta(
  playerElo: number,
  teamElo: number,
  oppTeamElo: number,
  won: boolean,
  performanceScore: number,
): number {
  const K = 24;
  const expectedWinRate = calcExpectedWinRate(teamElo, oppTeamElo);
  const actual = won ? 1 : 0;

  const performanceBonus = (performanceScore - 0.5) * 10;
  const delta = K * (actual - expectedWinRate) + performanceBonus;

  return delta;
}

export function calcAllElos(matches: Match[]): Map<string, number> {
  const playerElos = new Map<string, number>();

  // 모든 선수 초기 Elo = 1500
  const allPlayers = new Set<string>();
  for (const m of matches) {
    for (const [id] of [...m.blueTeam, ...m.redTeam]) {
      allPlayers.add(id);
      if (!playerElos.has(id)) playerElos.set(id, 1500);
    }
  }

  const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const match of sorted) {
    const blueTeam = winningTeam(match) === match.blueTeam ? match.blueTeam : match.redTeam;
    const redTeam = winningTeam(match) === match.blueTeam ? match.redTeam : match.blueTeam;
    const won = winningTeam(match) === match.blueTeam;

    const blueStats: Record<string, PerformanceData[]> = {};
    const redStats: Record<string, PerformanceData[]> = {};

    for (const [id] of blueTeam) {
      const stat = statOf(match, id);
      if (stat) {
        if (!blueStats[id]) blueStats[id] = [];
        blueStats[id].push({
          kda: (stat.kills + stat.assists) / Math.max(1, stat.deaths),
          dmg: (stat.heroDmg || 0) + (stat.siegeDmg || 0),
        });
      }
    }

    for (const [id] of redTeam) {
      const stat = statOf(match, id);
      if (stat) {
        if (!redStats[id]) redStats[id] = [];
        redStats[id].push({
          kda: (stat.kills + stat.assists) / Math.max(1, stat.deaths),
          dmg: (stat.heroDmg || 0) + (stat.siegeDmg || 0),
        });
      }
    }

    const blueScores = calcPerformanceScore(blueStats);
    const redScores = calcPerformanceScore(redStats);

    const blueElos = blueTeam.map(([id]) => playerElos.get(id) || 1500);
    const redElos = redTeam.map(([id]) => playerElos.get(id) || 1500);

    const blueTeamElo = calcTeamElo(blueElos);
    const redTeamElo = calcTeamElo(redElos);

    for (const [id] of blueTeam) {
      const currentElo = playerElos.get(id) || 1500;
      const performanceScore = blueScores.get(id) || 0.5;
      const delta = calcEloDelta(currentElo, blueTeamElo, redTeamElo, won, performanceScore);
      playerElos.set(id, currentElo + delta);
    }

    for (const [id] of redTeam) {
      const currentElo = playerElos.get(id) || 1500;
      const performanceScore = redScores.get(id) || 0.5;
      const delta = calcEloDelta(currentElo, redTeamElo, blueTeamElo, !won, performanceScore);
      playerElos.set(id, currentElo + delta);
    }
  }

  return playerElos;
}
