import { describe, it, expect } from 'vitest';
import { scrimTimeline, validateScrimPayload, PHASE_STARTS } from '../scrim';

// 선픽=blue 고정 시퀀스 기준 슬롯 위치:
// blue 밴 = 0,2,9 / red 밴 = 1,3,10 / blue 픽 = 4,7,8,13,14 / red 픽 = 5,6,11,12,15
const bans = { blue: ['b밴1', 'b밴2', 'b밴3'], red: ['r밴1', 'r밴2', 'r밴3'] };
const picks = {
  blue: ['b픽1', 'b픽2', 'b픽3', 'b픽4', 'b픽5'],
  red: ['r픽1', 'r픽2', 'r픽3', 'r픽4', 'r픽5'],
};

describe('scrimTimeline', () => {
  it('16스텝 — 밴6·픽10, 팀별 큐를 진행 순서대로 소비한다', () => {
    const tl = scrimTimeline(bans, picks);
    expect(tl).toHaveLength(16);
    expect(tl.filter((s) => s.kind === 'ban')).toHaveLength(6);
    expect(tl.filter((s) => s.kind === 'pick')).toHaveLength(10);

    // 밴1 페이즈: 선픽(blue)부터 교대로
    expect(tl[0]).toEqual({ kind: 'ban', team: 'blue', hero: 'b밴1' });
    expect(tl[1]).toEqual({ kind: 'ban', team: 'red', hero: 'r밴1' });
    // 미드밴은 각 팀 세 번째 밴
    expect(tl[9]).toEqual({ kind: 'ban', team: 'blue', hero: 'b밴3' });
    expect(tl[10]).toEqual({ kind: 'ban', team: 'red', hero: 'r밴3' });
    // 픽 순서 소비 확인 (red 연속 픽 5,6 / 마지막 픽 15)
    expect(tl[5]).toEqual({ kind: 'pick', team: 'red', hero: 'r픽1' });
    expect(tl[6]).toEqual({ kind: 'pick', team: 'red', hero: 'r픽2' });
    expect(tl[15]).toEqual({ kind: 'pick', team: 'red', hero: 'r픽5' });
  });

  it('부분 입력 — 채워진 만큼만 hero, 나머지는 빈 슬롯', () => {
    const tl = scrimTimeline({ blue: ['b밴1'], red: ['r밴1'] }, { blue: [], red: [] });
    expect(tl[0].hero).toBe('b밴1');
    expect(tl[1].hero).toBe('r밴1');
    expect(tl[2].hero).toBeUndefined();
    expect(tl[4].hero).toBeUndefined();
    expect(tl).toHaveLength(16);
  });

  it('페이즈 경계 = 밴1|픽1|밴2|픽2 시작 인덱스', () => {
    expect([...PHASE_STARTS].sort((a, b) => a - b)).toEqual([4, 9, 11]);
  });
});

describe('validateScrimPayload', () => {
  const good = {
    date: '2026-07-16', map: '용의 둥지', winner: 'blue' as const, patch: '2.55.8',
    bans, picks,
  };

  it('정상 payload는 null', () => {
    expect(validateScrimPayload(good)).toBeNull();
    expect(validateScrimPayload({ ...good, patch: undefined })).toBeNull();
  });

  it('맵·승자·날짜·밴픽 길이 오류를 잡는다', () => {
    expect(validateScrimPayload({ ...good, map: ' ' })).toBeTruthy();
    expect(validateScrimPayload({ ...good, winner: 'left' })).toBeTruthy();
    expect(validateScrimPayload({ ...good, date: '날짜아님' })).toBeTruthy();
    expect(validateScrimPayload({ ...good, bans: { ...bans, blue: ['하나'] } })).toBeTruthy();
    expect(validateScrimPayload({ ...good, picks: { ...picks, red: [...picks.red, '여섯'] } })).toBeTruthy();
  });
});
