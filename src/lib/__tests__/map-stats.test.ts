import { describe, it, expect } from 'vitest';
import { mapWinRates } from '../map-stats';
import type { Match } from '../types';

const mk = (id: string, map: string | undefined, winner: 'blue' | 'red'): Match => ({
  id,
  date: new Date('2025-06-01'),
  createdAt: new Date('2025-06-01'),
  map,
  blueTeam: [['me', 'h'], ['x1', 'h'], ['x2', 'h'], ['x3', 'h'], ['x4', 'h']],
  redTeam: [['x5', 'h'], ['x6', 'h'], ['x7', 'h'], ['x8', 'h'], ['x9', 'h']],
  winner,
});

describe('mapWinRates', () => {
  it('맵별 승/패를 집계한다', () => {
    const matches = [
      mk('m1', '하늘 신전', 'blue'),
      mk('m2', '하늘 신전', 'blue'),
      mk('m3', '하늘 신전', 'red'),
    ];
    const sky = mapWinRates('me', matches).find((r) => r.map === '하늘 신전')!;
    expect(sky.wins).toBe(2);
    expect(sky.losses).toBe(1);
    expect(sky.games).toBe(3);
    expect(sky.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('3경기 미만 맵은 winRate가 null (데이터 부족, 임계 검증)', () => {
    const matches = [
      mk('m1', '용의 둥지', 'blue'),
      mk('m2', '용의 둥지', 'red'),
    ];
    const den = mapWinRates('me', matches).find((r) => r.map === '용의 둥지')!;
    expect(den.games).toBe(2);
    expect(den.winRate).toBeNull();
  });

  it('맵 미기록 경기는 집계에서 제외한다', () => {
    const matches = [
      mk('m1', undefined, 'blue'),
      mk('m2', '   ', 'blue'),
      mk('m3', '하늘 신전', 'blue'),
    ];
    const result = mapWinRates('me', matches);
    expect(result.map((r) => r.map)).toEqual(['하늘 신전']);
  });

  it('미참가 경기는 제외한다', () => {
    const away: Match = {
      id: 'm9', date: new Date('2025-06-01'), createdAt: new Date('2025-06-01'),
      map: '공포의 정원',
      blueTeam: [['a', 'h'], ['b', 'h'], ['c', 'h'], ['d', 'h'], ['e', 'h']],
      redTeam: [['f', 'h'], ['g', 'h'], ['h', 'h'], ['i', 'h'], ['j', 'h']],
      winner: 'blue',
    };
    const result = mapWinRates('me', [away]);
    expect(result).toEqual([]);
  });

  it('충족 맵을 미충족 맵보다 먼저, 승률 내림차순으로 정렬한다', () => {
    const matches = [
      // 하늘 신전 3승 (100%)
      mk('a1', '하늘 신전', 'blue'), mk('a2', '하늘 신전', 'blue'), mk('a3', '하늘 신전', 'blue'),
      // 용의 둥지 3패 (0%)
      mk('b1', '용의 둥지', 'red'), mk('b2', '용의 둥지', 'red'), mk('b3', '용의 둥지', 'red'),
      // 영원의 전쟁터 1판 (데이터 부족)
      mk('c1', '영원의 전쟁터', 'blue'),
    ];
    const result = mapWinRates('me', matches);
    expect(result[0].map).toBe('하늘 신전');   // 100%
    expect(result[1].map).toBe('용의 둥지');   // 0%
    expect(result[2].map).toBe('영원의 전쟁터'); // null = 맨 뒤
    expect(result[2].winRate).toBeNull();
  });

  it('빈 경기 목록은 빈 배열', () => {
    expect(mapWinRates('me', [])).toEqual([]);
  });
});
