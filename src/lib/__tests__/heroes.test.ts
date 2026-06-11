import { describe, it, expect } from 'vitest';
import { roleOfHero } from '../heroes';

describe('roleOfHero', () => {
  it('영웅명으로 역할군을 반환한다', () => {
    expect(roleOfHero('겐지')).toBe('암살자');
    expect(roleOfHero('가로쉬')).toBe('탱커');
    expect(roleOfHero('루시우')).toBe('지원가');
    expect(roleOfHero('아바투르')).toBe('전문가');
    expect(roleOfHero('소냐')).toBe('투사');
  });

  it('모르는 영웅은 null을 반환한다', () => {
    expect(roleOfHero('존재하지않는영웅')).toBeNull();
  });
});
