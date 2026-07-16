import { describe, it, expect } from 'vitest';
import { buildSequence } from '../sequence';
import type { Step } from '../types';

const kinds = (s: Step[]) => s.map((x) => x.kind).join(',');
const teams = (s: Step[]) => s.map((x) => x.team).join(',');

describe('buildSequence', () => {
  it('16스텝: 밴6 + 픽10', () => {
    const seq = buildSequence('blue');
    expect(seq).toHaveLength(16);
    expect(seq.filter((s) => s.kind === 'ban')).toHaveLength(6);
    expect(seq.filter((s) => s.kind === 'pick')).toHaveLength(10);
  });

  it('kind 순서가 규격과 일치 (선픽=blue)', () => {
    expect(kinds(buildSequence('blue'))).toBe(
      'ban,ban,ban,ban,pick,pick,pick,pick,pick,ban,ban,pick,pick,pick,pick,pick',
    );
  });

  it('team 순서가 규격과 일치 (선픽=blue, F=blue S=red) — 미드밴은 후픽 팀 먼저', () => {
    expect(teams(buildSequence('blue'))).toBe(
      'blue,red,blue,red,blue,red,red,blue,blue,red,blue,red,red,blue,blue,red',
    );
  });

  it('선픽=red면 F/S가 뒤바뀐다', () => {
    expect(teams(buildSequence('red'))).toBe(
      'red,blue,red,blue,red,blue,blue,red,red,blue,red,blue,blue,red,red,blue',
    );
  });

  it('팀당 밴3 / 픽5', () => {
    const seq = buildSequence('blue');
    const count = (team: string, kind: string) =>
      seq.filter((s) => s.team === team && s.kind === kind).length;
    expect(count('blue', 'ban')).toBe(3);
    expect(count('red', 'ban')).toBe(3);
    expect(count('blue', 'pick')).toBe(5);
    expect(count('red', 'pick')).toBe(5);
  });
});
