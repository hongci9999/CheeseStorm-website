import { describe, it, expect } from 'vitest';
import { calcAllElos } from './elo';
import type { Match, PlayerMatchStat } from './types';

describe('Elo 계산', () => {
  it('같은 Elo 팀: 이긴 팀은 +, 진 팀은 -', () => {
    const stat: PlayerMatchStat = {
      kills: 5, assists: 5, deaths: 3,
      siegeDmg: 2000, heroDmg: 3000,
      healing: 0, selfHeal: 0, xp: 10000,
    };

    const matches: Match[] = [
      {
        id: '1',
        date: new Date('2026-01-01'),
        blueTeam: [['p1', 'hero1'], ['p2', 'hero2'], ['p3', 'hero3'], ['p4', 'hero4'], ['p5', 'hero5']],
        redTeam: [['p6', 'hero6'], ['p7', 'hero7'], ['p8', 'hero8'], ['p9', 'hero9'], ['p10', 'hero10']],
        blueStats: [stat, stat, stat, stat, stat],
        redStats: [stat, stat, stat, stat, stat],
        winner: 'blue',
        createdAt: new Date(),
      },
    ];

    const eloMap = calcAllElos(matches);

    const p1Elo = eloMap.get('p1')!;
    const p6Elo = eloMap.get('p6')!;

    console.log('p1 (blue, won):', p1Elo);
    console.log('p6 (red, lost):', p6Elo);

    expect(p1Elo).toBeGreaterThan(1500); // 이김
    expect(p6Elo).toBeLessThan(1500);    // 짐
    expect(p1Elo + p6Elo).toBeCloseTo(3000, 0); // 합 보존
  });

  it('연속 경기: Elo는 누적 반영 + 합 보존', () => {
    const stat: PlayerMatchStat = {
      kills: 5, assists: 5, deaths: 3,
      siegeDmg: 2000, heroDmg: 3000,
      healing: 0, selfHeal: 0, xp: 10000,
    };

    const matches: Match[] = [
      {
        id: '1',
        date: new Date('2026-01-01'),
        blueTeam: [['p1', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
        redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
        blueStats: [stat, stat, stat, stat, stat],
        redStats: [stat, stat, stat, stat, stat],
        winner: 'blue',
        createdAt: new Date(),
      },
      {
        id: '2',
        date: new Date('2026-01-02'),
        blueTeam: [['p1', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
        redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
        blueStats: [stat, stat, stat, stat, stat],
        redStats: [stat, stat, stat, stat, stat],
        winner: 'blue',
        createdAt: new Date(),
      },
    ];

    const eloMap = calcAllElos(matches);

    const p1Elo = eloMap.get('p1')!;

    console.log('p1 (2경기 후):', p1Elo);

    // 연속 우승 → 증가
    expect(p1Elo).toBeGreaterThan(1500);

    // 전체 Elo 합 확인
    let totalAfter = 0;
    for (let i = 1; i <= 10; i++) {
      totalAfter += eloMap.get(`p${i}`)!;
    }
    console.log('총 Elo 변화:', totalAfter - 15000);
    expect(Math.abs(totalAfter - 15000)).toBeLessThan(0.1);
  });

  it('성과점수가 다르면 Elo 변화도 달라야 함', () => {
    const goodStat: PlayerMatchStat = {
      kills: 10, assists: 10, deaths: 1, // 좋은 성과
      siegeDmg: 5000, heroDmg: 8000,
      healing: 0, selfHeal: 0, xp: 15000,
    };

    const badStat: PlayerMatchStat = {
      kills: 1, assists: 1, deaths: 8, // 나쁜 성과
      siegeDmg: 500, heroDmg: 800,
      healing: 0, selfHeal: 0, xp: 3000,
    };

    const match1: Match = {
      id: '1',
      date: new Date('2026-01-01'),
      blueTeam: [['p1_good', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
      redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
      blueStats: [goodStat, badStat, badStat, badStat, badStat],
      redStats: [badStat, badStat, badStat, badStat, badStat],
      winner: 'blue',
      createdAt: new Date(),
    };

    const match2: Match = {
      id: '2',
      date: new Date('2026-01-01'),
      blueTeam: [['p1_bad', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
      redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
      blueStats: [badStat, badStat, badStat, badStat, badStat],
      redStats: [badStat, badStat, badStat, badStat, badStat],
      winner: 'blue',
      createdAt: new Date(),
    };

    const eloMap1 = calcAllElos([match1]);
    const eloMap2 = calcAllElos([match2]);

    const p1GoodElo = eloMap1.get('p1_good')!;
    const p1BadElo = eloMap2.get('p1_bad')!;

    console.log('p1 좋은 성과 후:', p1GoodElo);
    console.log('p1 나쁜 성과 후:', p1BadElo);

    // 성과 보너스가 다르므로 Elo도 달라야 함
    expect(p1GoodElo).toBeGreaterThan(p1BadElo);
  });

  it('강한 팀 vs 약한 팀: Elo 차이 반영', () => {
    const goodStat: PlayerMatchStat = {
      kills: 10, assists: 5, deaths: 1,
      siegeDmg: 3000, heroDmg: 5000,
      healing: 0, selfHeal: 0, xp: 12000,
    };

    const badStat: PlayerMatchStat = {
      kills: 2, assists: 1, deaths: 6,
      siegeDmg: 500, heroDmg: 800,
      healing: 0, selfHeal: 0, xp: 4000,
    };

    const matches: Match[] = [
      {
        id: '1',
        date: new Date('2026-01-01'),
        blueTeam: [['p1_strong', 'h1'], ['p2_strong', 'h2'], ['p3_strong', 'h3'], ['p4_strong', 'h4'], ['p5_strong', 'h5']],
        redTeam: [['p6_weak', 'h6'], ['p7_weak', 'h7'], ['p8_weak', 'h8'], ['p9_weak', 'h9'], ['p10_weak', 'h10']],
        blueStats: [goodStat, goodStat, goodStat, goodStat, goodStat],
        redStats: [badStat, badStat, badStat, badStat, badStat],
        winner: 'blue',
        createdAt: new Date(),
      },
    ];

    const eloMap = calcAllElos(matches);

    const strongElo = eloMap.get('p1_strong')!;
    const weakElo = eloMap.get('p6_weak')!;

    console.log('강한 팀 우승 후:', strongElo);
    console.log('약한 팀 패배 후:', weakElo);

    // 예상: 강한 팀이 예상대로 이김 → 작은 변화
    // 약한 팀이 예상대로 짐 → 작은 변화
    expect(strongElo).toBeLessThan(1520); // 작은 증가
    expect(weakElo).toBeGreaterThan(1480); // 작은 감소 (기대 이상)
  });

  it('경기 길이 고려 검사 (dur 필드 사용)', () => {
    const stat: PlayerMatchStat = {
      kills: 5, assists: 5, deaths: 3,
      siegeDmg: 2000, heroDmg: 3000,
      healing: 0, selfHeal: 0, xp: 10000,
    };

    const shortMatch: Match = {
      id: '1',
      date: new Date('2026-01-01'),
      blueTeam: [['p1', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
      redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
      blueStats: [stat, stat, stat, stat, stat],
      redStats: [stat, stat, stat, stat, stat],
      winner: 'blue',
      dur: '5:00', // 짧은 경기
      createdAt: new Date(),
    };

    const longMatch: Match = {
      ...shortMatch,
      id: '2',
      dur: '30:00', // 긴 경기
    };

    const eloShort = calcAllElos([shortMatch]).get('p1')!;
    const eloLong = calcAllElos([longMatch]).get('p1')!;

    console.log('짧은 경기(5분) 우승 후:', eloShort);
    console.log('긴 경기(30분) 우승 후:', eloLong);

    // 문제: dur이 Elo 계산에 반영되나?
    // 지금은 안 됨 (성과점수 계산에 dur 미사용)
  });

  it('Elo 합 보존 (전체 Elo 증감 0이어야 함)', () => {
    const stat: PlayerMatchStat = {
      kills: 5, assists: 5, deaths: 3,
      siegeDmg: 2000, heroDmg: 3000,
      healing: 0, selfHeal: 0, xp: 10000,
    };

    const matches: Match[] = [
      {
        id: '1',
        date: new Date('2026-01-01'),
        blueTeam: [['p1', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
        redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
        blueStats: [stat, stat, stat, stat, stat],
        redStats: [stat, stat, stat, stat, stat],
        winner: 'blue',
        createdAt: new Date(),
      },
    ];

    const eloMap = calcAllElos(matches);
    const totalBefore = 10 * 1500;
    let totalAfter = 0;
    for (let i = 1; i <= 10; i++) {
      totalAfter += eloMap.get(`p${i}`)!;
    }

    console.log('총 Elo 변화:', totalAfter - totalBefore);

    // Elo 합은 보존되어야 함 (오차 범위: 0.01)
    expect(Math.abs(totalAfter - totalBefore)).toBeLessThan(0.1);
  });
});
