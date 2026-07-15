import { describe, it, expect } from 'vitest';
import { calcPlayerStats, groupStatsByTier } from '../tier';
import type { Match, PlayerStats, Streamer } from '../types';

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
  // 롤은 수동 입력이 아닌 내전 기록(플레이 영웅)에서 파생된다
  it('스트리머 롤을 플레이한 영웅의 역할군에서 파생한다', () => {
    const streamers = [{ ...makeStreamer('p1', '폭풍칼날'), role: '지원가' as const }];
    const matches = [
      makeMatch([['p1', '겐지']], [['x1', '우서']], 'blue'),
      makeMatch([['p1', '발라']], [['x1', '우서']], 'blue'),
    ];
    const stats = calcPlayerStats(streamers, matches);
    // 수동 role(지원가) 무시, 기록 기준 암살자
    expect(stats.find(s => s.streamerId === 'p1')!.role).toBe('암살자');
  });

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

const makeStat = (tier: PlayerStats['tier'], name = 'x'): PlayerStats => ({
  streamerId: name, streamerName: name, wins: 0, losses: 0,
  totalGames: 0, winRate: 0, tier, heroStats: [],
  recentWinRate: 0, streak: 0, eloRating: 1500,
});

describe('groupStatsByTier', () => {
  // 3. unranked 마지막 + 플레이어 소속 정확성
  it('각 그룹의 players는 해당 티어 스탯만 포함한다', () => {
    const p1 = makeStat('S', 'a');
    const p2 = makeStat('unranked', 'b');
    const p3 = makeStat('S', 'c');
    const groups = groupStatsByTier([p1, p2, p3]);
    const last = groups[groups.length - 1];
    expect(last.tier).toBe('unranked');
    expect(last.players).toEqual([p2]);
    const sGroup = groups.find(g => g.tier === 'S')!;
    expect(sGroup.players).toEqual([p1, p3]);
  });

  // 2. 순서 보장 (S~D는 빈 티어도 항상 표시)
  it('S → A → B → C → D → unranked 순서로 반환한다', () => {
    const stats = [makeStat('unranked'), makeStat('C'), makeStat('S'), makeStat('A')];
    const groups = groupStatsByTier(stats);
    const tiers = groups.map(g => g.tier);
    expect(tiers).toEqual(['S', 'A', 'B', 'C', 'D', 'unranked']);
  });

  // 1. S~D는 비어 있어도 포함, unranked만 비면 제외
  it('데이터 없는 S~D 티어도 결과에 포함한다', () => {
    const stats = [makeStat('S'), makeStat('C')];
    const groups = groupStatsByTier(stats);
    const tiers = groups.map(g => g.tier);
    expect(tiers).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(tiers).not.toContain('unranked');
  });
});
