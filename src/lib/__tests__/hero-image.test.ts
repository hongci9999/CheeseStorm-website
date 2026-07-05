import { describe, it, expect } from 'vitest';
import { CANONICAL_HEROES, HERO_SLUGS, heroImageUrl } from '../hero-image';
import { roleOfHero } from '../heroes';

describe('CANONICAL_HEROES', () => {
  it('slug 개수만큼 존재(별칭 중복 제거)', () => {
    expect(CANONICAL_HEROES).toHaveLength(HERO_SLUGS.length);
    expect(new Set(CANONICAL_HEROES).size).toBe(CANONICAL_HEROES.length);
  });

  it('모든 영웅이 역할군 매핑을 가진다', () => {
    for (const name of CANONICAL_HEROES) {
      expect(roleOfHero(name), `${name} 역할군 없음`).not.toBeNull();
    }
  });

  it('모든 영웅이 이미지 URL을 가진다', () => {
    for (const name of CANONICAL_HEROES) {
      expect(heroImageUrl(name), `${name} 이미지 없음`).toBeTruthy();
    }
  });
});
