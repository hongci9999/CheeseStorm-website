import { describe, it, expect } from 'vitest';
import { scrimTimeline, validateScrimPayload, assignScrimNumbers, PHASE_STARTS, type Scrim } from '../scrim';

// 선픽=blue 고정 시퀀스 기준 슬롯 위치 (미드밴은 후픽 팀 먼저):
// blue 밴 = 0,2,10 / red 밴 = 1,3,9 / blue 픽 = 4,7,8,13,14 / red 픽 = 5,6,11,12,15
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
    // 미드밴은 각 팀 세 번째 밴 — 후픽(red)이 먼저
    expect(tl[9]).toEqual({ kind: 'ban', team: 'red', hero: 'r밴3' });
    expect(tl[10]).toEqual({ kind: 'ban', team: 'blue', hero: 'b밴3' });
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

  it('seriesId 타입만 검증하고 값은 자유', () => {
    expect(validateScrimPayload({ ...good, seriesId: 'abc-123' })).toBeNull();
    expect(validateScrimPayload({ ...good, seriesId: 42 })).toBeTruthy();
  });
});

describe('assignScrimNumbers', () => {
  const mk = (id: string, date: string, createdAt: string, seriesId?: string): Scrim => ({
    id, date: new Date(date), createdAt: new Date(createdAt),
    map: '용의 둥지', winner: 'blue', bans, picks, seriesId,
  });

  it('gameNo는 세트 무관 전체 경기 중 오래된 순 전역 번호', () => {
    const s1 = mk('a', '2026-07-17', '2026-07-17T00:00:00Z', 'S1');
    const s2 = mk('b', '2026-07-18', '2026-07-18T00:00:00Z', 'S2');
    const s3 = mk('c', '2026-07-18', '2026-07-18T01:00:00Z', 'S2');
    const nums = assignScrimNumbers([s3, s1, s2]); // 입력 순서는 뒤섞여도 무관
    expect(nums.get('a')!.gameNo).toBe(1);
    expect(nums.get('b')!.gameNo).toBe(2);
    expect(nums.get('c')!.gameNo).toBe(3);
  });

  it('같은 seriesId는 한 세트로 묶여 세트 내 경기 순번이 오래된 순으로 매겨진다', () => {
    const s1 = mk('a', '2026-07-18', '2026-07-18T01:00:00Z', 'S1');
    const s2 = mk('b', '2026-07-18', '2026-07-18T03:00:00Z', 'S1');
    const s3 = mk('c', '2026-07-18', '2026-07-18T02:00:00Z', 'S1');
    const nums = assignScrimNumbers([s2, s1, s3]);
    expect(nums.get('a')).toMatchObject({ gameInSetNo: 1, gamesInSeries: 3 });
    expect(nums.get('c')).toMatchObject({ gameInSetNo: 2, gamesInSeries: 3 });
    expect(nums.get('b')).toMatchObject({ gameInSetNo: 3, gamesInSeries: 3 });
  });

  it('seriesId 없는 경기는 각자 1경기짜리 세트로 취급된다', () => {
    const s1 = mk('a', '2026-07-17', '2026-07-17T00:00:00Z');
    const nums = assignScrimNumbers([s1]);
    expect(nums.get('a')).toMatchObject({ gameInSetNo: 1, gamesInSeries: 1 });
  });

  it('dateSetNo는 같은 날짜 안에서만 시작 순서대로 매겨진다', () => {
    // 07-18에 세트 2개(S1이 먼저 시작), 07-19에 세트 1개 — 날짜가 다르면 번호가 독립적으로 1부터
    const s1a = mk('s1-a', '2026-07-18', '2026-07-18T01:00:00Z', 'S1');
    const s1b = mk('s1-b', '2026-07-18', '2026-07-18T02:00:00Z', 'S1');
    const s2a = mk('s2-a', '2026-07-18', '2026-07-18T05:00:00Z', 'S2');
    const s3a = mk('s3-a', '2026-07-19', '2026-07-19T00:00:00Z', 'S3');
    const nums = assignScrimNumbers([s3a, s2a, s1b, s1a]);
    expect(nums.get('s1-a')!.dateSetNo).toBe(1);
    expect(nums.get('s1-b')!.dateSetNo).toBe(1);
    expect(nums.get('s2-a')!.dateSetNo).toBe(2);
    expect(nums.get('s3-a')!.dateSetNo).toBe(1); // 다른 날짜라 독립적으로 1부터
  });

  it('세트의 대표 날짜는 세트 내 가장 오래된 경기의 날짜', () => {
    // S1이 07-17에 시작해 07-19까지 이어짐 → 대표 날짜는 07-17
    const s1 = mk('s1-a', '2026-07-17', '2026-07-17T00:00:00Z', 'S1');
    const s2 = mk('s1-b', '2026-07-19', '2026-07-19T00:00:00Z', 'S1');
    const s3 = mk('other', '2026-07-17', '2026-07-17T01:00:00Z');
    const nums = assignScrimNumbers([s1, s2, s3]);
    expect(nums.get('s1-a')!.dateSetNo).toBe(1);
    expect(nums.get('other')!.dateSetNo).toBe(2); // 07-17에서 S1보다 늦게 시작
  });
});
