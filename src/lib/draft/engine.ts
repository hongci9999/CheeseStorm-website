import { buildSequence } from './sequence';
import type { Team, DraftState, SetResult, Step } from './types';

const TOTAL_STEPS = 16;

// 상태를 깊은-얕은 혼합 복사 (배열·레코드는 새로 생성해 불변성 유지).
function cloneState(s: DraftState): DraftState {
  return {
    map: s.map,
    firstPick: s.firstPick,
    cursor: s.cursor,
    bans: { blue: [...s.bans.blue], red: [...s.bans.red] },
    picks: { blue: [...s.picks.blue], red: [...s.picks.red] },
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

// 픽 적용 (현재 스텝이 pick일 때만).
export function applyPick(state: DraftState, hero: string, playerId: string): DraftState {
  const step = currentStep(state);
  if (!step || step.kind !== 'pick') throw new Error('현재 스텝은 픽이 아니다');
  const next = cloneState(state);
  next.picks[step.team].push([playerId, hero]);
  next.cursor += 1;
  return next;
}

// 마지막 액션 되돌리기. cursor 0이면 무변화.
export function undo(state: DraftState): DraftState {
  if (state.cursor === 0) return state;
  const prev = buildSequence(state.firstPick)[state.cursor - 1];
  const next = cloneState(state);
  if (prev.kind === 'ban') next.bans[prev.team].pop();
  else next.picks[prev.team].pop();
  next.cursor -= 1;
  return next;
}

// 완료된 세트를 결과로 확정. 미완료면 예외.
export function finishSet(state: DraftState, winner: Team): SetResult {
  if (!isComplete(state)) throw new Error('드래프트가 완료되지 않았다');
  return {
    map: state.map,
    firstPick: state.firstPick,
    winner,
    bans: { blue: [...state.bans.blue], red: [...state.bans.red] },
    picks: { blue: [...state.picks.blue], red: [...state.picks.red] },
  };
}
