import { describe, it, expect } from 'vitest';
import { HOTS_MAPS, availableMaps } from '../maps';

describe('maps', () => {
  it('HOTS_MAPS는 전장 15종', () => {
    expect(HOTS_MAPS).toHaveLength(15);
    expect(HOTS_MAPS).toContain('용의 둥지');
  });

  it('availableMaps는 사용된 맵을 제외', () => {
    const result = availableMaps(['용의 둥지', '하늘 사원']);
    expect(result).not.toContain('용의 둥지');
    expect(result).not.toContain('하늘 사원');
    expect(result).toHaveLength(13);
  });

  it('사용된 맵이 없으면 전체 반환', () => {
    expect(availableMaps([])).toHaveLength(15);
  });
});
