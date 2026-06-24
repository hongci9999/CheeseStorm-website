import { describe, it, expect } from 'vitest';
import { calcHeroTiers, groupHeroesByTier } from '../hero-tier';
import type { Match } from '../types';

// ── 헬퍼: 한 영웅이 한쪽 팀에서 플레이한 경기 생성 ───────────────
// heroOnBlue가 blue팀 슬롯1, winner로 승패 제어. 나머지는 placeholder.
const mk = (id: string, blueHero: string, winner: 'blue' | 'red'): Match => ({
  id,
  date: new Date('2025-06-01'),
  createdAt: new Date('2025-06-01'),
  blueTeam: [['s1', blueHero], ['s2', 'x'], ['s3', 'x'], ['s4', 'x'], ['s5', 'x']],
  redTeam: [['s6', 'y'], ['s7', 'y'], ['s8', 'y'], ['s9', 'y'], ['s10', 'y']],
  winner,
});

describe('calcHeroTiers', () => {
  it('영웅별 승/패/판수를 집계한다', () => {
    // 겐지: blue에서 2승1패 (+ 'x' placeholder는 blue 패배 시 패 누적됨)
    const matches = [
      mk('m1', '겐지', 'blue'),
      mk('m2', '겐지', 'blue'),
      mk('m3', '겐지', 'red'),
    ];
    const genji = calcHeroTiers(matches).find((h) => h.hero === '겐지')!;
    expect(genji.wins).toBe(2);
    expect(genji.losses).toBe(1);
    expect(genji.games).toBe(3);
    expect(genji.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('3경기 미만 영웅은 unranked로 분리된다 (임계 검증)', () => {
    const matches = [
      mk('m1', '겐지', 'blue'),
      mk('m2', '겐지', 'blue'), // 겐지 2판만 → 미달
    ];
    const genji = calcHeroTiers(matches).find((h) => h.hero === '겐지')!;
    expect(genji.games).toBe(2);
    expect(genji.tier).toBe('unranked');
  });

  it('3경기 이상이면 승률 기준 티어가 부여된다', () => {
    // 겐지 5전 5승 = 100% → S
    const matches = [1, 2, 3, 4, 5].map((n) => mk(`m${n}`, '겐지', 'blue'));
    const genji = calcHeroTiers(matches).find((h) => h.hero === '겐지')!;
    expect(genji.tier).toBe('S');
  });

  it('영웅 역할군을 매핑한다 (알 수 없으면 null)', () => {
    const matches = [
      mk('m1', '겐지', 'blue'),
      mk('m2', '겐지', 'blue'),
      mk('m3', '겐지', 'blue'),
      mk('m4', '듣보영웅', 'blue'),
      mk('m5', '듣보영웅', 'blue'),
      mk('m6', '듣보영웅', 'blue'),
    ];
    const result = calcHeroTiers(matches);
    expect(result.find((h) => h.hero === '겐지')!.role).toBe('암살자');
    expect(result.find((h) => h.hero === '듣보영웅')!.role).toBeNull();
  });

  it('빈 영웅명은 집계하지 않는다', () => {
    const matches = [mk('m1', '  ', 'blue')];
    const result = calcHeroTiers(matches);
    expect(result.map((h) => h.hero)).not.toContain('');
  });

  it('티어 순으로 정렬된다 (S가 먼저)', () => {
    // 갓영웅 3승(S), 폐영웅 3패(D)
    const matches: Match[] = [
      mk('a1', '갓영웅', 'blue'),
      mk('a2', '갓영웅', 'blue'),
      mk('a3', '갓영웅', 'blue'),
      mk('b1', '폐영웅', 'red'),
      mk('b2', '폐영웅', 'red'),
      mk('b3', '폐영웅', 'red'),
    ];
    const result = calcHeroTiers(matches);
    const god = result.findIndex((h) => h.hero === '갓영웅');
    const trash = result.findIndex((h) => h.hero === '폐영웅');
    expect(god).toBeLessThan(trash);
  });

  it('빈 경기 목록은 빈 배열', () => {
    expect(calcHeroTiers([])).toEqual([]);
  });
});

describe('groupHeroesByTier', () => {
  it('S~D는 빈 티어도 표시하고 unranked만 비면 제외한다', () => {
    const matches: Match[] = [
      mk('a1', '갓영웅', 'blue'),
      mk('a2', '갓영웅', 'blue'),
      mk('a3', '갓영웅', 'blue'),
    ];
    const groups = groupHeroesByTier(calcHeroTiers(matches));
    const tiers = groups.map((g) => g.tier);
    // S~D는 비어 있어도 항상 포함 (unranked는 placeholder 'y'가 있어 표시)
    expect(tiers.slice(0, 5)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(groups.find((g) => g.tier === 'A')!.heroes).toEqual([]);
  });
});
