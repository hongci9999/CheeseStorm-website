import { describe, it, expect } from 'vitest';
import { aggregateHeroStats } from '../hero-stats';
import type { Match, PlayerMatchStat } from '../types';
import { MOCK_MATCHES } from '../../test/fixtures/matches';

// ── 인라인 픽스처 ──────────────────────────────────────────────

const statA: PlayerMatchStat = {
  kills: 5, assists: 7, deaths: 2,
  heroDmg: 30000, siegeDmg: 20000,
  healing: 0, selfHeal: 1500, xp: 10000,
};
const statB: PlayerMatchStat = {
  kills: 1, assists: 3, deaths: 4,
  heroDmg: 15000, siegeDmg: 10000,
  healing: 0, selfHeal: 500, xp: 9000,
};

// s1: 겐지 3판(2승1패) — 스탯 2경기, 스탯 없는 1경기
// s1: 발라 1판(1승) — 스탯 없음
const mk = (id: string, overrides: Partial<Match>): Match => ({
  id, date: new Date('2025-06-01'), createdAt: new Date('2025-06-01'),
  blueTeam: [['s1', '겐지'], ['s2', 'x'], ['s3', 'x'], ['s4', 'x'], ['s5', 'x']],
  redTeam:  [['s6', 'x'], ['s7', 'x'], ['s8', 'x'], ['s9', 'x'], ['s10', 'x']],
  winner: 'blue',
  ...overrides,
});

// 경기 1: s1 겐지, 블루 승, 스탯 있음
const m1 = mk('m1', {
  blueStats: [statA, statA, statA, statA, statA],
});
// 경기 2: s1 겐지, 블루 승, 스탯 있음
const m2 = mk('m2', {
  blueStats: [statB, statB, statB, statB, statB],
});
// 경기 3: s1 겐지, 블루 패(레드 승), 스탯 없음
const m3 = mk('m3', { winner: 'red' });
// 경기 4: s1 발라, 블루 승, 스탯 없음
const m4 = mk('m4', {
  blueTeam: [['s1', '발라'], ['s2', 'x'], ['s3', 'x'], ['s4', 'x'], ['s5', 'x']],
});
// 경기 5: s1 미참가
const m5: Match = {
  id: 'm5', date: new Date('2025-06-01'), createdAt: new Date('2025-06-01'),
  blueTeam: [['s2','x'],['s3','x'],['s4','x'],['s5','x'],['s6','x']],
  redTeam:  [['s7','x'],['s8','x'],['s9','x'],['s10','x'],['s11','x']],
  winner: 'blue',
};

const testMatches = [m1, m2, m3, m4, m5];

// ── 테스트 ──────────────────────────────────────────────────────

describe('aggregateHeroStats', () => {
  it('참가하지 않은 경기는 집계에서 제외한다', () => {
    const result = aggregateHeroStats('s1', testMatches);
    // s1 영웅 2종(겐지, 발라)만 나와야 함
    expect(result.map(h => h.hero)).not.toContain('x');
    expect(result).toHaveLength(2);
  });

  it('판수 많은 영웅이 먼저 온다', () => {
    const result = aggregateHeroStats('s1', testMatches);
    // 겐지 3판 > 발라 1판
    expect(result[0].hero).toBe('겐지');
    expect(result[1].hero).toBe('발라');
  });

  it('승패 집계가 정확하다 — 겐지 2승1패', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const genji = result.find(h => h.hero === '겐지')!;
    expect(genji.wins).toBe(2);
    expect(genji.losses).toBe(1);
    expect(genji.games).toBe(3);
  });

  it('스탯 없는 경기도 승패에는 포함, 평균엔 제외', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const genji = result.find(h => h.hero === '겐지')!;
    // 스탯 있는 경기는 m1, m2 두 판
    expect(genji.statGames).toBe(2);
    // games은 스탯 없는 m3 포함 3판
    expect(genji.games).toBe(3);
  });

  it('스탯 전혀 없는 영웅(발라)은 avgHeroDmg 등이 null', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const valla = result.find(h => h.hero === '발라')!;
    expect(valla.statGames).toBe(0);
    expect(valla.avgHeroDmg).toBeNull();
    expect(valla.avgKda).toBeNull();
    expect(valla.avgSiegeDmg).toBeNull();
    expect(valla.avgHealing).toBeNull();
    expect(valla.avgSelfHeal).toBeNull();
    expect(valla.avgXp).toBeNull();
  });

  it('avgHeroDmg는 스탯 기록 경기 평균이다', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const genji = result.find(h => h.hero === '겐지')!;
    // (30000 + 15000) / 2 = 22500
    expect(genji.avgHeroDmg).toBe(22500);
  });

  it('avgKda 계산: (총킬+총어시)/max(1,총데스)', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const genji = result.find(h => h.hero === '겐지')!;
    // statA: kills5 assists7 deaths2, statB: kills1 assists3 deaths4
    // kda = (5+1+7+3) / max(1, 2+4) = 16/6 = 2.67
    expect(genji.avgKda).toBe(Math.round((16 / 6) * 100) / 100);
  });

  it('경기 없으면 빈 배열 반환', () => {
    const result = aggregateHeroStats('s1', []);
    expect(result).toEqual([]);
  });

  it('빈 경기 목록에서 참가 없는 스트리머도 빈 배열', () => {
    const result = aggregateHeroStats('nonexistent', testMatches);
    expect(result).toEqual([]);
  });

  it('winRate는 wins/games', () => {
    const result = aggregateHeroStats('s1', testMatches);
    const genji = result.find(h => h.hero === '겐지')!;
    // 2/3 ≈ 0.6667
    expect(genji.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('MOCK_MATCHES 기준 s1은 겐지·발라·제이나 3종 집계', () => {
    const result = aggregateHeroStats('s1', MOCK_MATCHES);
    const heroes = result.map(h => h.hero);
    expect(heroes).toContain('겐지');
    expect(heroes).toContain('발라');
    expect(heroes).toContain('제이나');
    // 판수 합이 s1 총 참여경기 25판과 같아야 함
    const totalGames = result.reduce((acc, h) => acc + h.games, 0);
    expect(totalGames).toBe(25);
  });

  it('MOCK_MATCHES: statGames 합은 스탯 있는 경기(마지막 12판)에서 s1 참여수', () => {
    const result = aggregateHeroStats('s1', MOCK_MATCHES);
    const totalStatGames = result.reduce((acc, h) => acc + h.statGames, 0);
    // s1은 25판 전부 참여, 마지막 12경기(m14~m25)는 전부 스탯 있음 → 12판
    expect(totalStatGames).toBe(12);
  });
});
