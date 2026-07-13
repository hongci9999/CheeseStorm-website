import type { Match, PlayerStats } from './types';
import { winningTeam, losingTeam, statOf } from './match';

interface PerformanceData {
  kda: number;
  dmgPerMin: number; // 분당 피해 (경기 길이 고려)
}

function durToMins(dur: string | undefined): number {
  if (!dur) return 1;
  const m = dur.match(/^(\d+):(\d{2})$/);
  if (!m) return 1;
  const mins = Number(m[1]) + Number(m[2]) / 60;
  return mins > 0 ? mins : 1;
}

function calcPerformanceScore(
  stats: Record<string, PerformanceData[]>,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [playerId, playerStats] of Object.entries(stats)) {
    if (playerStats.length === 0) continue;

    const avgKda = playerStats.reduce((s, x) => s + x.kda, 0) / playerStats.length;
    const avgDmgPerMin = playerStats.reduce((s, x) => s + x.dmgPerMin, 0) / playerStats.length;

    // 절대값 기준 정규화 (경기 추가/삭제해도 변하지 않음)
    const kdaNorm = Math.min(1, Math.max(0, avgKda / 10)); // KDA: 0~10 → 0~1
    const dmgNorm = Math.min(1, Math.max(0, avgDmgPerMin / 300)); // DmgPerMin: 0~300 → 0~1

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
  const expectedWinRate = calcExpectedWinRate(teamElo, oppTeamElo);
  const actual = won ? 1 : 0;

  // K-factor를 성과에 따라 조정 (Elo 합 보존)
  // 성과 0.0 = K 80% 적용, 성과 1.0 = K 120% 적용
  const K = 24 * (0.8 + performanceScore * 0.4);

  const delta = K * (actual - expectedWinRate);

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

    const mins = durToMins(match.dur);

    const blueStats: Record<string, PerformanceData[]> = {};
    const redStats: Record<string, PerformanceData[]> = {};

    for (const [id] of blueTeam) {
      const stat = statOf(match, id);
      if (stat) {
        if (!blueStats[id]) blueStats[id] = [];
        const dmg = (stat.heroDmg || 0) + (stat.siegeDmg || 0);
        blueStats[id].push({
          kda: (stat.kills + stat.assists) / Math.max(1, stat.deaths),
          dmgPerMin: dmg / mins,
        });
      }
    }

    for (const [id] of redTeam) {
      const stat = statOf(match, id);
      if (stat) {
        if (!redStats[id]) redStats[id] = [];
        const dmg = (stat.heroDmg || 0) + (stat.siegeDmg || 0);
        redStats[id].push({
          kda: (stat.kills + stat.assists) / Math.max(1, stat.deaths),
          dmgPerMin: dmg / mins,
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
