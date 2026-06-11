import { describe, it, expect } from 'vitest';
import { deriveRole } from '../heroes';
import type { Match } from '../types';

// s1이 암살자 2회(겐지·제이나), 지원가 1회(루시우) 플레이
function mkMatch(id: string, date: string, s1Hero: string): Match {
  return {
    id,
    date: new Date(date),
    blueTeam: [['s1', s1Hero], ['s2', '우서'], ['s3', '무라딘'], ['s4', '소냐'], ['s5', '아바투르']],
    redTeam: [['s6', '리리'], ['s7', '발라'], ['s8', '가로쉬'], ['s9', '데하카'], ['s10', '자가라']],
    winner: 'blue',
    createdAt: new Date(date),
  };
}

describe('deriveRole', () => {
  it('가장 많이 플레이한 역할군을 반환한다', () => {
    const matches = [
      mkMatch('m1', '2025-06-01', '겐지'),
      mkMatch('m2', '2025-06-02', '루시우'),
      mkMatch('m3', '2025-06-03', '제이나'),
    ];
    expect(deriveRole(matches, 's1')).toBe('암살자');
  });

  it('경기가 없으면 undefined', () => {
    expect(deriveRole([], 's1')).toBeUndefined();
  });

  it('역할군을 모르는 영웅은 집계에서 제외한다', () => {
    const matches = [
      mkMatch('m1', '2025-06-01', '미확인영웅'),
      mkMatch('m2', '2025-06-02', '우서'),
    ];
    // 미확인영웅 무시 → 지원가 1회만 집계
    expect(deriveRole(matches, 's1')).toBe('지원가');
  });

  it('동률이면 최근 경기의 역할군을 우선한다', () => {
    const matches = [
      mkMatch('m1', '2025-06-01', '겐지'),   // 암살자 (과거)
      mkMatch('m2', '2025-06-05', '우서'),   // 지원가 (최근)
    ];
    expect(deriveRole(matches, 's1')).toBe('지원가');
    // 입력 순서 무관 — 날짜 기준
    expect(deriveRole([...matches].reverse(), 's1')).toBe('지원가');
  });
});
