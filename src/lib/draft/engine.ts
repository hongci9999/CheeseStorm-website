import { buildSequence } from './sequence';
import { CANONICAL_HEROES } from '../hero-image';
import type { Team, DraftState, SetResult, Step, Series, Pick } from './types';

const TOTAL_STEPS = 16;

// 상태를 깊은-얕은 혼합 복사 (배열·레코드는 새로 생성해 불변성 유지).
function cloneState(s: DraftState): DraftState {
  return {
    map: s.map,
    firstPick: s.firstPick,
    cursor: s.cursor,
    bans: { blue: [...s.bans.blue], red: [...s.bans.red] },
    picks: { blue: [...s.picks.blue], red: [...s.picks.red] },
    ...(s.assignment && { assignment: { blue: [...s.assignment.blue], red: [...s.assignment.red] } }),
  };
}

// 빈 진행 상태로 세트 시작.
export function startSet(map: string, firstPick: Team): DraftState {
  return {
    map,
    firstPick,
    cursor: 0,
    bans: { blue: [], red: [] },
    picks: { blue: [], red: [] },
  };
}

export function isComplete(state: DraftState): boolean {
  return state.cursor >= TOTAL_STEPS;
}

// 현재 커서의 스텝. 완료 시 null.
export function currentStep(state: DraftState): Step | null {
  if (isComplete(state)) return null;
  return buildSequence(state.firstPick)[state.cursor];
}

// 밴 적용 (현재 스텝이 ban일 때만).
export function applyBan(state: DraftState, hero: string): DraftState {
  const step = currentStep(state);
  if (!step || step.kind !== 'ban') throw new Error('현재 스텝은 밴이 아니다');
  const next = cloneState(state);
  next.bans[step.team].push(hero);
  next.cursor += 1;
  return next;
}

// 픽 적용 (현재 스텝이 pick일 때만). 영웅만 기록 — 누가 플레이할지는 완료 후 픽 교환에서 정한다.
export function applyPick(state: DraftState, hero: string): DraftState {
  const step = currentStep(state);
  if (!step || step.kind !== 'pick') throw new Error('현재 스텝은 픽이 아니다');
  const next = cloneState(state);
  next.picks[step.team].push(hero);
  next.cursor += 1;
  return next;
}

// 초갈(Cho'gall) — 머리 둘 오우거. 초·갈 두 스트리머가 연속 픽으로 나눠 가짐.
// 한쪽(초 or 갈)을 픽하면 다음 픽은 무조건 파트너로 강제됨(availableHeroes에서 처리).
export function isChogallHero(hero: string): boolean {
  return hero === '초' || hero === '갈';
}

// 현재 스텝에서 초갈 시작이 가능한가 — 현재+다음 스텝이 모두 같은 팀 픽(연속 픽 2칸).
export function canPickChogall(state: DraftState): boolean {
  const seq = buildSequence(state.firstPick);
  const cur = seq[state.cursor];
  const nxt = seq[state.cursor + 1];
  return !!cur && cur.kind === 'pick' && !!nxt && nxt.kind === 'pick' && cur.team === nxt.team;
}

// 마지막 액션 되돌리기. cursor 0이면 무변화.
export function undo(state: DraftState): DraftState {
  if (state.cursor === 0) return state;
  const prev = buildSequence(state.firstPick)[state.cursor - 1];
  const next = cloneState(state);
  if (prev.kind === 'ban') next.bans[prev.team].pop();
  else next.picks[prev.team].pop();
  next.cursor -= 1;
  delete next.assignment; // 완료 후 되돌리면 배정 무효 → 재완료 시 기본 배정부터
  return next;
}

// 완료된 세트를 결과로 확정. 미완료면 예외.
// 슬롯 i의 스트리머 = series[team][i], 그가 플레이할 영웅 = assignment[team][i]를 zip해
// 기존 SetResult.picks(Pick[]) 포맷으로 조립.
export function finishSet(state: DraftState, winner: Team, series?: Series): SetResult {
  if (!isComplete(state)) throw new Error('드래프트가 완료되지 않았다');
  const assignment = state.assignment ?? buildDefaultAssignment(state);
  const zip = (team: Team): Pick[] =>
    assignment[team].map((hero, i) => {
      const pid = series ? (team === 'blue' ? series.blue : series.red)[i]?.id ?? `slot:${team}:${i}` : `slot:${team}:${i}`;
      return [pid, hero];
    });
  return {
    map: state.map,
    firstPick: state.firstPick,
    winner,
    bans: { blue: [...state.bans.blue], red: [...state.bans.red] },
    picks: { blue: zip('blue'), red: zip('red') },
  };
}

// 드래프트 완료 시 기본 영웅 배정 — 슬롯 i(=스트리머 i)가 i번째로 픽된 영웅을 플레이(픽 순서 그대로).
export function buildDefaultAssignment(state: DraftState): Record<Team, string[]> {
  return { blue: [...state.picks.blue], red: [...state.picks.red] };
}

// 소프트 피어리스에서만 의미 있음 — 그 플레이어가 이전 세트에서 이 영웅을 이미 썼으면 배정 불가.
export function canAssign(series: Series, team: Team, hero: string, playerId: string): boolean {
  if (series.draftType !== 'soft') return true;
  return !heroesPlayedBy(series.sets, playerId).has(hero);
}

// 같은 팀 두 슬롯의 영웅 교환(스트리머 위치는 고정) — 소프트 위반 시 null(스왑 취소).
export function swapAssignment(
  series: Series, state: DraftState, team: Team, i: number, j: number,
): DraftState | null {
  const base = state.assignment ?? buildDefaultAssignment(state);
  const arr = [...base[team]];
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length || i === j) return null;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  // 슬롯 k의 스트리머 = series[team][k]. 스왑으로 바뀐 두 슬롯 모두 그 스트리머가 새 영웅을 쓸 수 있는지 검증.
  const roster = team === 'blue' ? series.blue : series.red;
  if (!canAssign(series, team, arr[i], roster[i]?.id ?? '')) return null;
  if (!canAssign(series, team, arr[j], roster[j]?.id ?? '')) return null;
  const next = cloneState(state);
  next.assignment = { blue: [...base.blue], red: [...base.red] };
  next.assignment[team] = arr;
  return next;
}

// 이번 세트에서 이미 소비된(밴+픽) 영웅 집합.
function usedThisSet(state: DraftState): Set<string> {
  const used = new Set<string>();
  for (const h of state.bans.blue) used.add(h);
  for (const h of state.bans.red) used.add(h);
  for (const h of state.picks.blue) used.add(h);
  for (const h of state.picks.red) used.add(h);
  return used;
}

// 이전 세트들에서 특정 플레이어가 픽한 영웅 집합 (소프트 피어리스용).
export function heroesPlayedBy(sets: SetResult[], playerId: string): Set<string> {
  const played = new Set<string>();
  for (const set of sets) {
    for (const team of ['blue', 'red'] as Team[]) {
      for (const [pid, hero] of set.picks[team]) {
        if (pid === playerId) played.add(hero);
      }
    }
  }
  return played;
}

// 이전 세트들에서 누구든 픽한 영웅 집합 (하드 피어리스용).
export function heroesPickedInSeries(sets: SetResult[]): Set<string> {
  const picked = new Set<string>();
  for (const set of sets) {
    for (const team of ['blue', 'red'] as Team[]) {
      for (const [, hero] of set.picks[team]) picked.add(hero);
    }
  }
  return picked;
}

// 현재 스텝에서 선택 가능한 영웅 목록.
// 소프트 피어리스의 플레이어별 제약은 드래프트 중엔 적용 안 함 — 픽 교환 단계(canAssign)에서 처리.
export function availableHeroes(series: Series, state: DraftState): string[] {
  const step = currentStep(state);
  const excluded = usedThisSet(state);

  if (series.draftType === 'hard') {
    for (const h of heroesPickedInSeries(series.sets)) excluded.add(h);
  }

  // 초갈: 픽으로 초/갈 하나만 소비된 상태면 다음 픽은 무조건 파트너로 강제.
  if (step?.kind === 'pick') {
    const cho = pickedThisSet(state).has('초');
    const gall = pickedThisSet(state).has('갈');
    if (cho !== gall) {
      const partner = cho ? '갈' : '초';
      return excluded.has(partner) ? [] : [partner];
    }
  }

  // 초갈 시작: 픽 스텝은 연속 픽 창 + 초·갈 둘 다 미소비일 때만 노출. 밴은 개별 허용.
  const chogallOpen = step?.kind === 'pick' && canPickChogall(state)
    && !excluded.has('초') && !excluded.has('갈');

  return CANONICAL_HEROES.filter((h) => {
    if (isChogallHero(h)) {
      return step?.kind === 'ban' ? !excluded.has(h) : chogallOpen;
    }
    return !excluded.has(h);
  });
}

// 이번 세트에서 픽(밴 제외)된 영웅 집합.
function pickedThisSet(state: DraftState): Set<string> {
  const picked = new Set<string>();
  for (const h of state.picks.blue) picked.add(h);
  for (const h of state.picks.red) picked.add(h);
  return picked;
}
