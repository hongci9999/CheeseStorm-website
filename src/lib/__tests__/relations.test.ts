import { describe, it, expect } from 'vitest';
import { computeRelations } from '../relations';
import type { Match, Streamer } from '../types';

const streamers: Streamer[] = [
  'me', 'ally', 'foe', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8',
].map((id) => ({ id, name: id.toUpperCase(), createdAt: new Date('2025-01-01') }));

// me + ally 같은 팀(blue), foe 적팀(red). winner로 me 승패 제어.
const mk = (id: string, winner: 'blue' | 'red'): Match => ({
  id,
  date: new Date('2025-06-01'),
  createdAt: new Date('2025-06-01'),
  blueTeam: [['me', 'h'], ['ally', 'h'], ['x1', 'h'], ['x2', 'h'], ['x3', 'h']],
  redTeam: [['foe', 'h'], ['x4', 'h'], ['x5', 'h'], ['x6', 'h'], ['x7', 'h']],
  winner,
});

describe('computeRelations - 시너지', () => {
  it('같은 팀 공동 출현 3경기 이상만 집계한다 (임계 검증)', () => {
    // me+ally 2경기만 → 미달 → 시너지 비표시
    const matches = [mk('m1', 'blue'), mk('m2', 'red')];
    const { synergy } = computeRelations('me', streamers, matches);
    expect(synergy.find((s) => s.streamerId === 'ally')).toBeUndefined();
  });

  it('3경기 이상 함께 뛴 팀원의 승률을 계산한다', () => {
    const matches = [mk('m1', 'blue'), mk('m2', 'blue'), mk('m3', 'red')];
    const { synergy } = computeRelations('me', streamers, matches);
    const ally = synergy.find((s) => s.streamerId === 'ally')!;
    expect(ally.streamerName).toBe('ALLY');
    expect(ally.games).toBe(3);
    expect(ally.wins).toBe(2);
    expect(ally.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('자기 자신은 시너지에 포함되지 않는다', () => {
    const matches = [mk('m1', 'blue'), mk('m2', 'blue'), mk('m3', 'blue')];
    const { synergy } = computeRelations('me', streamers, matches);
    expect(synergy.find((s) => s.streamerId === 'me')).toBeUndefined();
  });
});

describe('computeRelations - 천적', () => {
  it('적팀 공동 출현 3경기 이상만 집계한다 (임계 검증)', () => {
    const matches = [mk('m1', 'blue'), mk('m2', 'red')]; // foe 2경기만
    const { nemesis } = computeRelations('me', streamers, matches);
    expect(nemesis.find((n) => n.streamerId === 'foe')).toBeUndefined();
  });

  it('적으로 만나 내가 진 비율을 계산한다', () => {
    // m1 blue승(me승), m2 red승(me패), m3 red승(me패) → me 1승2패 vs foe
    const matches = [mk('m1', 'blue'), mk('m2', 'red'), mk('m3', 'red')];
    const { nemesis } = computeRelations('me', streamers, matches);
    const foe = nemesis.find((n) => n.streamerId === 'foe')!;
    expect(foe.games).toBe(3);
    expect(foe.losses).toBe(2);
    expect(foe.lossRate).toBeCloseTo(2 / 3, 5);
  });

  it('패율 내림차순으로 정렬된다', () => {
    // foe: 3패(패율1.0), x4: 같은 적팀이지만 일부만 → 둘 다 3경기 이상이면 패율 비교
    const matches = [mk('m1', 'red'), mk('m2', 'red'), mk('m3', 'red')];
    const { nemesis } = computeRelations('me', streamers, matches);
    // 모든 red 팀원이 3경기 3패 → 동률, 정렬은 이름순 폴백
    expect(nemesis.length).toBeGreaterThan(0);
    expect(nemesis[0].lossRate).toBe(1);
  });
});

describe('computeRelations - 일반', () => {
  it('미참가 스트리머는 빈 결과', () => {
    const matches = [mk('m1', 'blue'), mk('m2', 'blue'), mk('m3', 'blue')];
    const { synergy, nemesis } = computeRelations('nobody', streamers, matches);
    expect(synergy).toEqual([]);
    expect(nemesis).toEqual([]);
  });

  it('이름을 못 찾으면 id로 폴백한다', () => {
    const matches = [mk('m1', 'blue'), mk('m2', 'blue'), mk('m3', 'blue')];
    const { synergy } = computeRelations('me', [], matches);
    const ally = synergy.find((s) => s.streamerId === 'ally')!;
    expect(ally.streamerName).toBe('ally');
  });
});
