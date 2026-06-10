import { describe, it, expect } from 'vitest';
import { validateMatchForm } from '../match';

const team5 = (prefix: string): [string, string][] =>
  Array.from({ length: 5 }, (_, i) => [`${prefix}${i}`, '겐지']);

describe('validateMatchForm', () => {
  // 3. 중복 스트리머 거부
  it('같은 스트리머가 양 팀에 동시 등록되면 invalid를 반환한다', () => {
    const blue = team5('p');
    const red: [string, string][] = [
      ['p0', '우서'], ['r1', '가로쉬'], ['r2', '리밍'], ['r3', '케리건'], ['r4', '겐지'],
    ];
    const result = validateMatchForm(blue, red);
    expect(result.valid).toBe(false);
  });

  // 2. 빈 영웅명 거부
  it('영웅명이 빈 문자열인 플레이어가 있으면 invalid를 반환한다', () => {
    const blue: [string, string][] = [
      ['p1', '겐지'], ['p2', '우서'], ['p3', '가로쉬'], ['p4', '리밍'], ['p5', ''],
    ];
    const result = validateMatchForm(blue, team5('r'));
    expect(result.valid).toBe(false);
  });

  // 1. 5인 미만 팀 거부
  it('블루팀이 5인 미만이면 invalid를 반환한다', () => {
    const result = validateMatchForm(
      [['p1', '겐지'], ['p2', '우서']],
      team5('r'),
    );
    expect(result.valid).toBe(false);
  });
});
