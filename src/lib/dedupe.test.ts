import { describe, it, expect } from 'vitest';
import { findDuplicateMatch } from './dedupe';
import type { Match } from './types';

// ── 테스트용 경기 팩토리 ──────────────────────────────────────────
function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    date: new Date('2025-06-01'),
    blueTeam: [['s1', '겐지'], ['s2', '루시우'], ['s3', '가로쉬'], ['s4', '소냐'], ['s5', '아바투르']],
    redTeam:  [['s6', '리밍'], ['s7', '말퓨리온'], ['s8', '디아블로'], ['s9', '스랄'], ['s10', '노바']],
    winner: 'blue',
    dur: '21:04',
    createdAt: new Date('2025-06-01'),
    ...overrides,
  };
}

const BASE_BLUE: [string, string][] = [
  ['s1', '겐지'], ['s2', '루시우'], ['s3', '가로쉬'], ['s4', '소냐'], ['s5', '아바투르'],
];
const BASE_RED: [string, string][] = [
  ['s6', '리밍'], ['s7', '말퓨리온'], ['s8', '디아블로'], ['s9', '스랄'], ['s10', '노바'],
];

describe('findDuplicateMatch', () => {
  it('날짜 + 멤버셋 + dur 완전 일치 → strong 중복', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: '21:04' },
      existing,
    );
    expect(result.level).toBe('strong');
    expect(result.match).toBeDefined();
  });

  it('같은 멤버·다른 dur → 중복 없음 (none)', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: '28:47' },
      existing,
    );
    expect(result.level).toBe('none');
  });

  it('blue/red 팀 스왑 → strong 중복 (진영 무관 멤버셋 비교)', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    // blue↔red 뒤집어서 저장 시도
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_RED, redTeam: BASE_BLUE, dur: '21:04' },
      existing,
    );
    expect(result.level).toBe('strong');
  });

  it('dur 없음 → weak 경고', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: undefined },
      existing,
    );
    expect(result.level).toBe('weak');
    expect(result.match).toBeDefined();
  });

  it('날짜 다름 → 중복 없음', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-02'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: '21:04' },
      existing,
    );
    expect(result.level).toBe('none');
  });

  it('멤버 일부 다름 → 중복 없음', () => {
    const existing = [makeMatch({ dur: '21:04' })];
    const differentBlue: [string, string][] = [
      ['s1', '겐지'], ['s2', '루시우'], ['s3', '가로쉬'], ['s4', '소냐'], ['s99', '제이나'], // s5 → s99
    ];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: differentBlue, redTeam: BASE_RED, dur: '21:04' },
      existing,
    );
    expect(result.level).toBe('none');
  });

  it('기존 경기 목록 비어 있음 → 중복 없음', () => {
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: '21:04' },
      [],
    );
    expect(result.level).toBe('none');
    expect(result.match).toBeUndefined();
  });

  it('기존 경기 dur 없고 신규 dur도 없음 → weak 경고', () => {
    const existing = [makeMatch({ dur: undefined })];
    const result = findDuplicateMatch(
      { date: new Date('2025-06-01'), blueTeam: BASE_BLUE, redTeam: BASE_RED, dur: undefined },
      existing,
    );
    // 신규 dur 없으면 weak (기존 dur 유무 무관)
    expect(result.level).toBe('weak');
  });
});
