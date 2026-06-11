import type { Match, PlayerMatchStat } from './types';

const MIN_TEAM_SIZE = 5;

type Team = [string, string][];
type Result = { valid: true } | { valid: false; error: string };

// ── 단일 경기 질의 ───────────────────────────────────────────
// blue/red는 임의 레이블, 승패는 속한 팀 기준 (ADR-0002). 이 규칙은 여기에만.

function teamOf(m: Match, streamerId: string): 'blue' | 'red' | null {
  if (m.blueTeam.some(([id]) => id === streamerId)) return 'blue';
  if (m.redTeam.some(([id]) => id === streamerId)) return 'red';
  return null;
}

// 이 경기에서 해당 스트리머의 승패. 참가하지 않았으면 null.
export function outcomeFor(m: Match, streamerId: string): 'win' | 'loss' | null {
  const side = teamOf(m, streamerId);
  if (!side) return null;
  return side === m.winner ? 'win' : 'loss';
}

// 이 경기에서 해당 스트리머가 플레이한 영웅. 참가하지 않았으면 null.
export function heroOf(m: Match, streamerId: string): string | null {
  const slot =
    m.blueTeam.find(([id]) => id === streamerId) ??
    m.redTeam.find(([id]) => id === streamerId);
  return slot?.[1] ?? null;
}

// 이긴 팀 / 진 팀 로스터.
export function winningTeam(m: Match): Team {
  return m.winner === 'blue' ? m.blueTeam : m.redTeam;
}

export function losingTeam(m: Match): Team {
  return m.winner === 'blue' ? m.redTeam : m.blueTeam;
}

// 양 팀 참가자 전원(10명) 합집합.
export function participants(m: Match): Team {
  return [...m.blueTeam, ...m.redTeam];
}

// 이 경기에서 해당 스트리머의 개인 스탯. 스탯 미기록·비참가면 null.
export function statOf(m: Match, streamerId: string): PlayerMatchStat | null {
  const bi = m.blueTeam.findIndex(([id]) => id === streamerId);
  if (bi >= 0) return m.blueStats?.[bi] ?? null;
  const ri = m.redTeam.findIndex(([id]) => id === streamerId);
  if (ri >= 0) return m.redStats?.[ri] ?? null;
  return null;
}

export function validateMatchForm(blueTeam: Team, redTeam: Team): Result {
  if (blueTeam.length < MIN_TEAM_SIZE || redTeam.length < MIN_TEAM_SIZE)
    return { valid: false, error: `양 팀 모두 ${MIN_TEAM_SIZE}명이어야 합니다.` };
  const hasEmptyHero = [...blueTeam, ...redTeam].some(([, hero]) => !hero.trim());
  if (hasEmptyHero)
    return { valid: false, error: '모든 플레이어의 영웅명을 입력해주세요.' };
  const blueIds = new Set(blueTeam.map(([id]) => id));
  const hasDuplicate = redTeam.some(([id]) => blueIds.has(id));
  if (hasDuplicate)
    return { valid: false, error: '같은 스트리머가 양 팀에 등록되어 있습니다.' };
  return { valid: true };
}
