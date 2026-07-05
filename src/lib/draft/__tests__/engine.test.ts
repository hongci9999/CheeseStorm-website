import { describe, it, expect } from 'vitest';
import {
  startSet, currentStep, isComplete, applyBan, applyPick, undo, finishSet, availableHeroes,
} from '../engine';
import { buildSequence } from '../sequence';
import type { DraftState, Series, SetResult } from '../types';
import { CANONICAL_HEROES } from '../../hero-image';

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

// 테스트용 시리즈 팩토리. 캐노니컬 영웅 3종을 상수로 사용.
const H0 = CANONICAL_HEROES[0];
const H1 = CANONICAL_HEROES[1];
const H2 = CANONICAL_HEROES[2];

function makeSeries(over: Partial<Series>): Series {
  return {
    draftType: 'normal',
    bestOf: 3,
    blue: [], red: [], sets: [], current: null,
    ...over,
  };
}

function priorSet(picks: SetResult['picks']): SetResult {
  return { map: '용의 둥지', firstPick: 'blue', winner: 'blue', bans: { blue: [], red: [] }, picks };
}

describe('availableHeroes', () => {
  it('이번 세트 밴/픽된 영웅은 전 종류에서 제외', () => {
    const series = makeSeries({ draftType: 'normal' });
    let state = startSet('하늘 사원', 'blue');
    state = applyBan(state, H0);                 // 밴됨
    const list = availableHeroes(series, state);
    expect(list).not.toContain(H0);
    expect(list).toContain(H1);
  });

  it('일반: 이전 세트 픽은 다시 고를 수 있다', () => {
    const series = makeSeries({
      draftType: 'normal',
      sets: [priorSet({ blue: [['p1', H0]], red: [] })],
    });
    const state = startSet('하늘 사원', 'blue');
    expect(availableHeroes(series, state)).toContain(H0);
  });

  it('하드: 이전 세트 누구든 픽한 영웅은 전역 제외', () => {
    const series = makeSeries({
      draftType: 'hard',
      sets: [priorSet({ blue: [['p1', H0]], red: [['p2', H1]] })],
    });
    const state = startSet('하늘 사원', 'blue');
    const list = availableHeroes(series, state);
    expect(list).not.toContain(H0);
    expect(list).not.toContain(H1);
    expect(list).toContain(H2);
  });

  it('소프트: 그 플레이어가 이전 세트에 픽한 영웅만 제외', () => {
    const series = makeSeries({
      draftType: 'soft',
      sets: [priorSet({ blue: [['p1', H0]], red: [['p2', H1]] })],
    });
    // 첫 픽 스텝까지 밴 4개 소비
    let state = startSet('하늘 사원', 'blue');
    state = applyBan(state, 'x1'); state = applyBan(state, 'x2');
    state = applyBan(state, 'x3'); state = applyBan(state, 'x4');
    // p1이 픽하는 경우: H0 잠김, H1(다른 사람 것)은 가능
    const forP1 = availableHeroes(series, state, 'p1');
    expect(forP1).not.toContain(H0);
    expect(forP1).toContain(H1);
    // p2가 픽하는 경우: H1 잠김, H0 가능
    const forP2 = availableHeroes(series, state, 'p2');
    expect(forP2).not.toContain(H1);
    expect(forP2).toContain(H0);
  });

  it('소프트: 밴 스텝(forPlayerId 없음)은 이전 픽 제약 없음', () => {
    const series = makeSeries({
      draftType: 'soft',
      sets: [priorSet({ blue: [['p1', H0]], red: [] })],
    });
    const state = startSet('하늘 사원', 'blue'); // 첫 스텝은 밴
    expect(availableHeroes(series, state)).toContain(H0);
  });
});
