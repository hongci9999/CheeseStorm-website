import { describe, it, expect } from 'vitest';
import {
  startSet, currentStep, isComplete, applyBan, applyPick, undo, finishSet,
} from '../engine';
import { buildSequence } from '../sequence';
import type { DraftState } from '../types';

// 16스텝을 순서대로 소비하는 헬퍼 (밴은 hero, 픽은 hero+player).
function playThrough(state: DraftState): DraftState {
  let s = state;
  let i = 0;
  while (!isComplete(s)) {
    const step = currentStep(s)!;
    if (step.kind === 'ban') s = applyBan(s, `ban${i}`);
    else s = applyPick(s, `hero${i}`, `p${i}`);
    i++;
  }
  return s;
}

describe('engine 상태 전이', () => {
  it('startSet은 빈 상태에서 cursor 0', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(s.cursor).toBe(0);
    expect(s.map).toBe('용의 둥지');
    expect(s.firstPick).toBe('blue');
    expect(s.bans).toEqual({ blue: [], red: [] });
    expect(currentStep(s)).toEqual({ kind: 'ban', team: 'blue' });
  });

  it('applyBan은 현재 스텝 팀에 밴 추가 후 커서 전진', () => {
    const s = applyBan(startSet('용의 둥지', 'blue'), '겐지');
    expect(s.cursor).toBe(1);
    expect(s.bans.blue).toEqual(['겐지']);
    // 다음 스텝은 밴:red
    expect(currentStep(s)).toEqual({ kind: 'ban', team: 'red' });
  });

  it('픽 스텝에서 applyBan은 예외', () => {
    let s = startSet('용의 둥지', 'blue');
    // 밴4개 소비 → 첫 픽 스텝
    s = applyBan(s, 'b1'); s = applyBan(s, 'b2');
    s = applyBan(s, 'b3'); s = applyBan(s, 'b4');
    expect(currentStep(s)!.kind).toBe('pick');
    expect(() => applyBan(s, 'x')).toThrow();
  });

  it('applyPick은 [playerId, hero]를 해당 팀에 추가', () => {
    let s = startSet('용의 둥지', 'blue');
    s = applyBan(s, 'b1'); s = applyBan(s, 'b2');
    s = applyBan(s, 'b3'); s = applyBan(s, 'b4');
    // 첫 픽: 선픽 blue
    s = applyPick(s, '겐지', 'player1');
    expect(s.picks.blue).toEqual([['player1', '겐지']]);
    expect(s.cursor).toBe(5);
  });

  it('undo는 마지막 액션을 되돌린다', () => {
    let s = startSet('용의 둥지', 'blue');
    s = applyBan(s, '겐지');
    s = undo(s);
    expect(s.cursor).toBe(0);
    expect(s.bans.blue).toEqual([]);
  });

  it('cursor 0에서 undo는 무변화', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(undo(s)).toEqual(s);
  });

  it('16스텝 소비 후 isComplete', () => {
    const s = playThrough(startSet('용의 둥지', 'blue'));
    expect(isComplete(s)).toBe(true);
    expect(currentStep(s)).toBeNull();
    expect(s.picks.blue).toHaveLength(5);
    expect(s.picks.red).toHaveLength(5);
    expect(s.bans.blue).toHaveLength(3);
    expect(s.bans.red).toHaveLength(3);
  });

  it('finishSet은 완료 상태에서만 SetResult 반환', () => {
    const done = playThrough(startSet('용의 둥지', 'blue'));
    const result = finishSet(done, 'red');
    expect(result.winner).toBe('red');
    expect(result.map).toBe('용의 둥지');
    expect(result.firstPick).toBe('blue');
    expect(result.picks.blue).toHaveLength(5);
  });

  it('미완료 상태에서 finishSet은 예외', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(() => finishSet(s, 'blue')).toThrow();
  });

  it('전이 함수는 입력 상태를 변형하지 않는다(불변)', () => {
    const s = startSet('용의 둥지', 'blue');
    applyBan(s, '겐지');
    expect(s.cursor).toBe(0);
    expect(s.bans.blue).toEqual([]);
  });
});
