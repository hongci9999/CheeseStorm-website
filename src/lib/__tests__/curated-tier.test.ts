import { describe, it, expect } from 'vitest';
import {
  buildCuratedPlayers,
  groupCuratedByTier,
  listsFromPlacements,
  moveStreamer,
  sanitizeLists,
} from '../curated-tier';
import { MOCK_STREAMERS } from '../../test/fixtures/streamers';
import { MOCK_MATCHES } from '../../test/fixtures/matches';

describe('listsFromPlacements', () => {
  it('placements를 티어별 순서 목록으로 변환한다', () => {
    const lists = listsFromPlacements({ s1: 'S', s2: 'B' }, MOCK_STREAMERS.slice(0, 3));
    expect(lists.S).toEqual(['s1']);
    expect(lists.B).toEqual(['s2']);
  });
});

describe('buildCuratedPlayers', () => {
  it('배치된 스트리머는 해당 티어, 나머지는 unranked', () => {
    const lists = listsFromPlacements({ s1: 'S', s2: 'B' }, MOCK_STREAMERS.slice(0, 3));
    const list = buildCuratedPlayers(MOCK_STREAMERS.slice(0, 3), lists, MOCK_MATCHES);
    expect(list.find((p) => p.streamerId === 's1')?.tier).toBe('S');
    expect(list.find((p) => p.streamerId === 's2')?.tier).toBe('B');
    expect(list.find((p) => p.streamerId === 's3')?.tier).toBe('unranked');
  });

  it('티어 내 순서를 lists 순서대로 유지한다', () => {
    const lists = { S: ['s2', 's1'], A: [], B: [], C: [], D: [] };
    const list = buildCuratedPlayers(MOCK_STREAMERS.slice(0, 2), lists, MOCK_MATCHES);
    const sTier = list.filter((p) => p.tier === 'S');
    expect(sTier.map((p) => p.streamerId)).toEqual(['s2', 's1']);
  });
});

describe('moveStreamer', () => {
  it('unranked로 이동하면 모든 티어 목록에서 제거한다', () => {
    const lists = listsFromPlacements({ s1: 'A' }, MOCK_STREAMERS.slice(0, 1));
    expect(moveStreamer(lists, 's1', 'unranked').A).toEqual([]);
  });

  it('같은 티어 내에서 순서를 변경한다', () => {
    const lists = { S: ['s1', 's2', 's3'], A: [], B: [], C: [], D: [] };
    const next = moveStreamer(lists, 's3', 'S', 's1');
    expect(next.S).toEqual(['s3', 's1', 's2']);
  });

  it('다른 티어 셀 앞에 삽입한다', () => {
    const lists = listsFromPlacements({ s1: 'S', s2: 'A' }, MOCK_STREAMERS.slice(0, 2));
    const next = moveStreamer(lists, 's1', 'A', 's2');
    expect(next.S).toEqual([]);
    expect(next.A).toEqual(['s1', 's2']);
  });
});

describe('sanitizeLists', () => {
  it('삭제된 스트리머를 목록에서 제거한다', () => {
    const lists = { S: ['s1', 'gone'], A: [], B: [], C: [], D: [] };
    expect(sanitizeLists(lists, ['s1']).S).toEqual(['s1']);
  });
});

describe('groupCuratedByTier', () => {
  it('S와 unranked 행은 비어 있어도 표시한다', () => {
    const groups = groupCuratedByTier([
      { streamerId: 's1', streamerName: 'A', tier: 'S' },
    ]);
    expect(groups.some((g) => g.tier === 'S')).toBe(true);
    expect(groups.some((g) => g.tier === 'unranked')).toBe(true);
  });

  it('편집 모드에서는 빈 S~D 행을 모두 표시한다', () => {
    const groups = groupCuratedByTier(
      [{ streamerId: 's1', streamerName: 'A', tier: 'S' }],
      { showEmptyTiers: true, includeUnranked: false },
    );
    expect(groups.map((g) => g.tier)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });
});
