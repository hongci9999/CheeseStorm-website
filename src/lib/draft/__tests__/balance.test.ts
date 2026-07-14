import { describe, it, expect } from 'vitest';
import { balanceByElo, teamElo } from '../balance';
import type { Player } from '../types';

const p = (id: string): Player => ({ id, name: id });

// id를 그대로 Elo로 쓰는 헬퍼 (id = '1600' → 1600)
const eloOf = (id: string) => Number(id);

describe('balanceByElo', () => {
  it('팀장(첫 슬롯)은 바뀌지 않는다', () => {
    const blue = ['1900', '1000', '1000', '1000', '1000'].map(p);
    const red = ['1100', '1800', '1800', '1800', '1800'].map(p);

    const r = balanceByElo(blue, red, eloOf);

    expect(r.blue[0].id).toBe('1900');
    expect(r.red[0].id).toBe('1100');
  });

  it('Elo 합 차이를 최소화하고 인원은 5:5를 유지한다', () => {
    const blue = ['1900', '1000', '1000', '1000', '1000'].map(p);
    const red = ['1100', '1800', '1800', '1800', '1800'].map(p);

    const before = Math.abs(teamElo(blue, eloOf) - teamElo(red, eloOf)); // |5900-8300| = 2400
    const r = balanceByElo(blue, red, eloOf);
    const after = Math.abs(teamElo(r.blue, eloOf) - teamElo(r.red, eloOf));

    expect(r.blue).toHaveLength(5);
    expect(r.red).toHaveLength(5);
    expect(after).toBeLessThan(before);
    // 최적: 블루 1900 + (1800,1800,1000,1000) = 7500 / 레드 1100 + (1800,1800,1000,1000) = 6700 → 800
    expect(after).toBe(800);
  });

  it('5명씩이 아니면 그대로 반환', () => {
    const blue = ['1500', '1500'].map(p);
    const red = ['1500'].map(p);
    expect(balanceByElo(blue, red, eloOf)).toEqual({ blue, red });
  });
});
