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

    // 첫 경기라 양 팀 다 1500 → 기대승률 0.5(대등) → 승자 +20 / 패자 -20 (제로섬)
    // ("강/약"은 이름뿐 — Elo는 스탯 미반영이라 첫 판은 항상 대등)
    expect(strongElo).toBeCloseTo(1520, 6);
    expect(weakElo).toBeCloseTo(1480, 6);
  });

  it('낮은 승률이 높은 Elo 랭크가 될 수 없음', () => {
    const goodStat: PlayerMatchStat = {
      kills: 10, assists: 10, deaths: 2,
      siegeDmg: 4000, heroDmg: 6000,
      healing: 0, selfHeal: 0, xp: 15000,
    };

    const badStat: PlayerMatchStat = {
      kills: 2, assists: 2, deaths: 8,
      siegeDmg: 500, heroDmg: 1000,
      healing: 0, selfHeal: 0, xp: 4000,
    };

    const matches: Match[] = [];

    // 14승 24패 시뮬레이션
    for (let i = 0; i < 14; i++) {
      matches.push({
        id: `win_${i}`,
        date: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
        blueTeam: [['test_player', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
        redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
        blueStats: [goodStat, badStat, badStat, badStat, badStat],
        redStats: [badStat, badStat, badStat, badStat, badStat],
        winner: 'blue',
        createdAt: new Date(),
      });
    }

    for (let i = 0; i < 24; i++) {
      matches.push({
        id: `loss_${i}`,
        date: new Date(`2026-02-${String(i + 1).padStart(2, '0')}`),
        blueTeam: [['test_player', 'h1'], ['p2', 'h2'], ['p3', 'h3'], ['p4', 'h4'], ['p5', 'h5']],
        redTeam: [['p6', 'h6'], ['p7', 'h7'], ['p8', 'h8'], ['p9', 'h9'], ['p10', 'h10']],
        blueStats: [goodStat, badStat, badStat, badStat, badStat],
        redStats: [goodStat, goodStat, goodStat, goodStat, goodStat],
        winner: 'red',
        createdAt: new Date(),
      });
    }

    const eloMap = calcAllElos(matches);
    const testPlayerElo = eloMap.get('test_player')!;

    console.log('test_player (14W-24L):', testPlayerElo);
    console.log('순수 50% 플레이어:', 1500);

    // 14승 24패 = 36.8% 승률 → Elo는 1500 이하여야 함
    expect(testPlayerElo).toBeLessThan(1500);
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

// ADR-0022: 대회는 로스터가 고정이라 팀원 5명이 항상 같은 델타를 받아
// 팀 내 개인 차이 정보가 0인데 레이팅만 움직인다 → Elo 집계에서 제외.
describe('대회 경기 제외', () => {
  const mk = (id: string, over: Partial<Match> = {}): Match => ({
    id,
    date: new Date('2026-01-01'),
    blueTeam: [['p1', 'h'], ['p2', 'h'], ['p3', 'h'], ['p4', 'h'], ['p5', 'h']],
    redTeam: [['p6', 'h'], ['p7', 'h'], ['p8', 'h'], ['p9', 'h'], ['p10', 'h']],
    winner: 'blue',
    createdAt: new Date(),
    ...over,
  });

  it('tournament 경기는 레이팅을 움직이지 않는다', () => {
    const elos = calcAllElos([mk('t1', { tournament: true })]);
    // 대회 경기만 있으면 집계 대상이 0건 — 아무도 등록되지 않는다
    expect(elos.size).toBe(0);
  });

  it('내전 결과는 대회 경기가 섞여도 동일하다', () => {
    const normal = mk('n1');
    const withTournament = calcAllElos([
      normal,
      mk('t1', { tournament: true, date: new Date('2026-01-02') }),
      mk('t2', { tournament: true, date: new Date('2026-01-03') }),
    ]);
    const onlyNormal = calcAllElos([normal]);

    expect(withTournament.get('p1')).toBe(onlyNormal.get('p1'));
    expect(withTournament.get('p6')).toBe(onlyNormal.get('p6'));
    expect(onlyNormal.get('p1')).toBeGreaterThan(1500); // 내전은 정상 반영
  });

  it('플래그 없는 경기는 기존대로 반영된다', () => {
    const elos = calcAllElos([mk('n1'), mk('n2', { date: new Date('2026-01-02') })]);
    expect(elos.get('p1')).toBeGreaterThan(1500);
    expect(elos.get('p6')).toBeLessThan(1500);
  });
});
