import { describe, it, expect } from 'vitest';
import { calcDelta } from '../elo';

const K = 32;

describe('calcDelta — 등락폭 스케일링', () => {
  it('기대승률 25%에서 언더독이 이기면 +K, 75%에서 강팀이 지면 -K', () => {
    expect(calcDelta(1, 0.25)).toBeCloseTo(K, 6);
    expect(calcDelta(0, 0.75)).toBeCloseTo(-K, 6);
  });

  it('25%/75% 바깥은 ±K로 클램프', () => {
    expect(calcDelta(1, 0.1)).toBe(K);
    expect(calcDelta(0, 0.9)).toBe(-K);
  });

  it('동등한 팀(50%)은 표준 K/2가 아니라 스케일된 값', () => {
    expect(calcDelta(1, 0.5)).toBeCloseTo(K * 0.5 / 0.75, 6); // ≈ 21.33
    expect(calcDelta(0, 0.5)).toBeCloseTo(-K * 0.5 / 0.75, 6);
  });

  it('제로섬 — 양 팀 델타 합은 0', () => {
    for (const e of [0.1, 0.3, 0.5, 0.62, 0.8]) {
      // 블루 승: 블루는 (1, e), 레드는 (0, 1-e)
      expect(calcDelta(1, e) + calcDelta(0, 1 - e)).toBeCloseTo(0, 6);
    }
  });
});
