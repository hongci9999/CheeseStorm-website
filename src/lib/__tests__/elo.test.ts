import { describe, it, expect } from 'vitest';
import { calcDelta } from '../elo';

describe('calcDelta — 로지스틱 등락폭', () => {
  it('대등(50%) 승은 +20', () => {
    expect(calcDelta(1, 0.5)).toBeCloseTo(20, 6);
    expect(calcDelta(0, 0.5)).toBeCloseTo(-20, 6);
  });

  it('언더독(30%) 승은 +35, 강팀(70%) 승은 +5', () => {
    expect(calcDelta(1, 0.3)).toBeCloseTo(35, 6);
    expect(calcDelta(1, 0.7)).toBeCloseTo(5, 6);
  });

  it('강팀(70%) 패는 -35, 언더독(30%) 패는 -5 (승과 대칭)', () => {
    expect(calcDelta(0, 0.7)).toBeCloseTo(-35, 6);
    expect(calcDelta(0, 0.3)).toBeCloseTo(-5, 6);
  });

  it('30/70% 바깥은 완만히 포화 — 이변일수록 40 수렴, 압승일수록 0 수렴', () => {
    // 0.3→0.1 은 +4 남짓만 더 오르고 40을 넘지 않음
    expect(calcDelta(1, 0.1)).toBeGreaterThan(35);
    expect(calcDelta(1, 0.1)).toBeLessThan(40);
    // 0.7→0.9 는 5→0 사이로 완만히 감소, 항상 양수
    expect(calcDelta(1, 0.9)).toBeGreaterThan(0);
    expect(calcDelta(1, 0.9)).toBeLessThan(5);
  });

  it('제로섬 — 양 팀 델타 합은 0', () => {
    for (const e of [0.1, 0.3, 0.5, 0.62, 0.8]) {
      // 블루 승: 블루는 (1, e), 레드는 (0, 1-e)
      expect(calcDelta(1, e) + calcDelta(0, 1 - e)).toBeCloseTo(0, 6);
    }
  });
});
