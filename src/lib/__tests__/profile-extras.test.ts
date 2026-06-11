import { describe, it, expect } from 'vitest';
import { roleAffinity } from '../heroes';
import { currentStreak, kdaFor } from '../profile';
import type { Match, PlayerMatchStat } from '../types';

function mk(id: string, date: string, s1Hero: string, winner: 'blue' | 'red'): Match {
  return {
    id, date: new Date(date), createdAt: new Date(date), winner,
    blueTeam: [['s1', s1Hero], ['s2', '우서'], ['s3', '무라딘'], ['s4', '소냐'], ['s5', '아바투르']],
    redTeam: [['s6', '리리'], ['s7', '발라'], ['s8', '가로쉬'], ['s9', '데하카'], ['s10', '자가라']],
  };
}

describe('roleAffinity', () => {
  it('역할군별 판수·비율을 판수 내림차순으로 반환한다', () => {
    const matches = [
      mk('m1', '2025-06-01', '겐지', 'blue'),
      mk('m2', '2025-06-02', '발라', 'blue'),
      mk('m3', '2025-06-03', '우서', 'blue'),  // s1이 우서? — s1Hero 자리만 바뀜
      mk('m4', '2025-06-04', '리밍', 'blue'),
    ];
    const aff = roleAffinity(matches, 's1');
    expect(aff[0]).toEqual({ role: '암살자', games: 3, pct: 75 });
    expect(aff[1]).toEqual({ role: '지원가', games: 1, pct: 25 });
  });

  it('기록 없으면 빈 배열', () => {
    expect(roleAffinity([], 's1')).toEqual([]);
  });
});

describe('currentStreak', () => {
  it('가장 최근 경기부터 연속 승수를 센다', () => {
    const matches = [
      mk('m1', '2025-06-01', '겐지', 'red'),   // 패 (과거)
      mk('m2', '2025-06-02', '겐지', 'blue'),  // 승
      mk('m3', '2025-06-03', '겐지', 'blue'),  // 승 (최근)
    ];
    expect(currentStreak(matches, 's1')).toEqual({ result: 'win', count: 2 });
  });

  it('연패도 센다', () => {
    const matches = [
      mk('m1', '2025-06-01', '겐지', 'blue'),
      mk('m2', '2025-06-02', '겐지', 'red'),
    ];
    expect(currentStreak(matches, 's1')).toEqual({ result: 'loss', count: 1 });
  });

  it('경기 없으면 null', () => {
    expect(currentStreak([], 's1')).toBeNull();
  });
});

describe('kdaFor', () => {
  const stat = (kills: number, assists: number, deaths: number): PlayerMatchStat =>
    ({ kills, assists, deaths, siegeDmg: 0, heroDmg: 0, healing: 0, selfHeal: 0, xp: 0 });

  it('스탯 있는 경기들의 (킬+어시)/데스 합산 KDA를 반환한다', () => {
    const m1 = mk('m1', '2025-06-01', '겐지', 'blue');
    m1.blueStats = [stat(4, 6, 2), stat(0, 0, 0), stat(0, 0, 0), stat(0, 0, 0), stat(0, 0, 0)];
    const m2 = mk('m2', '2025-06-02', '겐지', 'blue');
    m2.blueStats = [stat(2, 8, 3), stat(0, 0, 0), stat(0, 0, 0), stat(0, 0, 0), stat(0, 0, 0)];
    // (4+6+2+8) / (2+3) = 20/5 = 4
    expect(kdaFor([m1, m2], 's1')).toBe(4);
  });

  it('스탯 있는 경기가 없으면 null', () => {
    expect(kdaFor([mk('m1', '2025-06-01', '겐지', 'blue')], 's1')).toBeNull();
  });
});
