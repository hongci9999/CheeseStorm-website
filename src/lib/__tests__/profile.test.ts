import { describe, it, expect } from 'vitest';
import { getStreamerProfile, getRecentMatches } from '../profile';
import { MOCK_STREAMERS } from '../../test/fixtures/streamers';
import { MOCK_MATCHES } from '../../test/fixtures/matches';

describe('getRecentMatches', () => {
  it('해당 스트리머가 참여한 경기만 반환한다', () => {
    // s1은 MOCK_MATCHES 10경기 전부 참여
    const result = getRecentMatches('s1', MOCK_MATCHES, 99);
    expect(result).toHaveLength(10);
    result.forEach(m => {
      const participated =
        m.blueTeam.some(([id]) => id === 's1') ||
        m.redTeam.some(([id]) => id === 's1');
      expect(participated).toBe(true);
    });
  });

  it('n개 제한이 적용되고 날짜 최신순으로 반환한다', () => {
    const result = getRecentMatches('s1', MOCK_MATCHES, 3);
    expect(result).toHaveLength(3);
    // 최신 3경기: m9·m10(2025-06-07), m7·m8(2025-06-05) 중 상위 3
    expect(result[0].date.getTime()).toBeGreaterThanOrEqual(result[1].date.getTime());
    expect(result[1].date.getTime()).toBeGreaterThanOrEqual(result[2].date.getTime());
  });
});

describe('getStreamerProfile', () => {
  it('존재하지 않는 ID면 null을 반환한다', () => {
    const result = getStreamerProfile('없는id', MOCK_STREAMERS, MOCK_MATCHES);
    expect(result).toBeNull();
  });

  it('s1의 승/패/티어를 정확히 계산한다', () => {
    // s1은 10경기 7승 3패 → winRate 0.7 → Tier S
    const result = getStreamerProfile('s1', MOCK_STREAMERS, MOCK_MATCHES);
    expect(result).not.toBeNull();
    expect(result!.wins).toBe(7);
    expect(result!.losses).toBe(3);
    expect(result!.totalGames).toBe(10);
    expect(result!.tier).toBe('S');
  });
});
