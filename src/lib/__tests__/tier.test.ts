import { describe, it, expect } from 'vitest';
import { calcPlayerStats } from '../tier';
import type { Match, Streamer } from '../types';

const makeStreamer = (id: string, name: string): Streamer => ({
  id, name, createdAt: new Date(),
});

const makeMatch = (
  blueTeam: [string, string][],
  redTeam: [string, string][],
  winner: 'blue' | 'red',
): Match => ({
  id: Math.random().toString(),
  date: new Date(),
  createdAt: new Date(),
  blueTeam,
  redTeam,
  winner,
});

describe('calcPlayerStats', () => {
  // 1. 트레이서: [id, hero][] 형식에서 승/패 카운트
  it('[id, hero][] 형식 경기에서 승/패를 정확히 집계한다', () => {
    const streamers = [makeStreamer('p1', '폭풍칼날'), makeStreamer('p2', '한빛')];
    const matches = [
      makeMatch([['p1', '겐지'], ['p2', '우서']], [], 'blue'),
      makeMatch([['p1', '겐지'], ['p2', '우서']], [], 'blue'),
      makeMatch([], [['p1', '겐지'], ['p2', '우서']], 'blue'),
    ];

    const stats = calcPlayerStats(streamers, matches);
    const p1 = stats.find(s => s.streamerId === 'p1')!;
    const p2 = stats.find(s => s.streamerId === 'p2')!;

    expect(p1.wins).toBe(2);
    expect(p1.losses).toBe(1);
    expect(p2.wins).toBe(2);
    expect(p2.losses).toBe(1);
  });

  // 2. 영웅별 승률 집계
  it('영웅별 승/패를 heroStats에 집계한다', () => {
    const streamers = [makeStreamer('p1', '폭풍칼날')];
    const matches = [
      makeMatch([['p1', '겐지']], [], 'blue'),
      makeMatch([['p1', '겐지']], [], 'blue'),
      makeMatch([['p1', '한조']], [], 'blue'),
      makeMatch([], [['p1', '겐지']], 'blue'),
    ];

    const [p1] = calcPlayerStats(streamers, matches);

    const genji = p1.heroStats.find(h => h.hero === '겐지')!;
    const hanzo = p1.heroStats.find(h => h.hero === '한조')!;

    expect(genji.wins).toBe(2);
    expect(genji.losses).toBe(1);
    expect(hanzo.wins).toBe(1);
    expect(hanzo.losses).toBe(0);
  });

  // 3. heroStats 경기수 내림차순 정렬
  it('heroStats를 총 경기수 내림차순으로 정렬한다', () => {
    const streamers = [makeStreamer('p1', '폭풍칼날')];
    const matches = [
      makeMatch([['p1', '한조']], [], 'blue'),
      makeMatch([['p1', '겐지']], [], 'blue'),
      makeMatch([['p1', '겐지']], [], 'blue'),
      makeMatch([['p1', '겐지']], [], 'blue'),
    ];

    const [p1] = calcPlayerStats(streamers, matches);

    expect(p1.heroStats[0].hero).toBe('겐지');   // 3경기
    expect(p1.heroStats[1].hero).toBe('한조');   // 1경기
  });

  // 4. 3경기 미만 unranked
  it('3경기 미만이면 unranked를 반환한다', () => {
    const streamers = [makeStreamer('p1', '폭풍칼날')];
    const matches = [
      makeMatch([['p1', '겐지']], [], 'blue'),
      makeMatch([['p1', '겐지']], [], 'blue'),
    ];

    const [p1] = calcPlayerStats(streamers, matches);
    expect(p1.tier).toBe('unranked');
  });
});
