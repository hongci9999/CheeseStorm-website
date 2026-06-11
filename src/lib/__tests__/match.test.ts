import { describe, it, expect } from 'vitest';
import { validateMatchForm, outcomeFor, heroOf, winningTeam, losingTeam, participants } from '../match';
import type { Match } from '../types';

const team5 = (prefix: string): [string, string][] =>
  Array.from({ length: 5 }, (_, i) => [`${prefix}${i}`, '겐지']);

// blue가 이긴 경기: 블루 s1~s5(겐지), 레드 s6~s10
const blueWinMatch: Match = {
  id: 'qm1',
  date: new Date('2025-06-01'),
  blueTeam: [['s1', '겐지'], ['s2', '루시우'], ['s3', '제이나'], ['s4', '아바투르'], ['s5', '가로쉬']],
  redTeam: [['s6', '스터코프'], ['s7', '레이너'], ['s8', '아나'], ['s9', '실바나스'], ['s10', '제라툴']],
  winner: 'blue',
  createdAt: new Date('2025-06-01'),
};

describe('validateMatchForm', () => {
  // 3. 중복 스트리머 거부
  it('같은 스트리머가 양 팀에 동시 등록되면 invalid를 반환한다', () => {
    const blue = team5('p');
    const red: [string, string][] = [
      ['p0', '우서'], ['r1', '가로쉬'], ['r2', '리밍'], ['r3', '케리건'], ['r4', '겐지'],
    ];
    const result = validateMatchForm(blue, red);
    expect(result.valid).toBe(false);
  });

  // 2. 빈 영웅명 거부
  it('영웅명이 빈 문자열인 플레이어가 있으면 invalid를 반환한다', () => {
    const blue: [string, string][] = [
      ['p1', '겐지'], ['p2', '우서'], ['p3', '가로쉬'], ['p4', '리밍'], ['p5', ''],
    ];
    const result = validateMatchForm(blue, team5('r'));
    expect(result.valid).toBe(false);
  });

  // 1. 5인 미만 팀 거부
  it('블루팀이 5인 미만이면 invalid를 반환한다', () => {
    const result = validateMatchForm(
      [['p1', '겐지'], ['p2', '우서']],
      team5('r'),
    );
    expect(result.valid).toBe(false);
  });
});

describe('outcomeFor', () => {
  it('이긴 팀(블루)에 속한 스트리머는 win을 반환한다', () => {
    expect(outcomeFor(blueWinMatch, 's1')).toBe('win');
  });

  it('진 팀(레드)에 속한 스트리머는 loss를 반환한다', () => {
    expect(outcomeFor(blueWinMatch, 's6')).toBe('loss');
  });

  it('레드가 이기면 레드 스트리머가 win이다 (레이블은 임의값)', () => {
    const redWin: Match = { ...blueWinMatch, winner: 'red' };
    expect(outcomeFor(redWin, 's6')).toBe('win');
    expect(outcomeFor(redWin, 's1')).toBe('loss');
  });

  it('경기에 참가하지 않은 스트리머는 null을 반환한다', () => {
    expect(outcomeFor(blueWinMatch, 's99')).toBeNull();
  });
});

describe('heroOf', () => {
  it('참가한 스트리머가 플레이한 영웅을 반환한다', () => {
    expect(heroOf(blueWinMatch, 's2')).toBe('루시우');
    expect(heroOf(blueWinMatch, 's7')).toBe('레이너');
  });

  it('참가하지 않은 스트리머는 null을 반환한다', () => {
    expect(heroOf(blueWinMatch, 's99')).toBeNull();
  });
});

describe('winningTeam / losingTeam', () => {
  it('winner에 따라 이긴 팀과 진 팀 로스터를 반환한다', () => {
    expect(winningTeam(blueWinMatch)).toEqual(blueWinMatch.blueTeam);
    expect(losingTeam(blueWinMatch)).toEqual(blueWinMatch.redTeam);
  });

  it('레드 승이면 이긴 팀이 레드다', () => {
    const redWin: Match = { ...blueWinMatch, winner: 'red' };
    expect(winningTeam(redWin)).toEqual(redWin.redTeam);
    expect(losingTeam(redWin)).toEqual(redWin.blueTeam);
  });
});

describe('participants', () => {
  it('양 팀 10명을 합쳐 반환한다', () => {
    const all = participants(blueWinMatch);
    expect(all).toHaveLength(10);
    expect(all.map(([id]) => id)).toContain('s1');
    expect(all.map(([id]) => id)).toContain('s10');
  });
});
