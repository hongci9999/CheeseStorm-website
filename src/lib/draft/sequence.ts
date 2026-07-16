import type { Team, Step } from './types';

// F(선픽 팀)/S(후픽 팀) 기준 16스텝 템플릿.
// 밴1: F S F S / 픽1: F S S F F / 밴2: S F / 픽2: S S F F S
// 미드밴(밴2)은 다음 픽 차례인 후픽 팀이 먼저 밴한다 — 실제 HotS 드래프트 순서.
const TEMPLATE: Array<{ kind: 'ban' | 'pick'; ref: 'F' | 'S' }> = [
  { kind: 'ban', ref: 'F' }, { kind: 'ban', ref: 'S' },
  { kind: 'ban', ref: 'F' }, { kind: 'ban', ref: 'S' },
  { kind: 'pick', ref: 'F' },
  { kind: 'pick', ref: 'S' }, { kind: 'pick', ref: 'S' },
  { kind: 'pick', ref: 'F' }, { kind: 'pick', ref: 'F' },
  { kind: 'ban', ref: 'S' }, { kind: 'ban', ref: 'F' },
  { kind: 'pick', ref: 'S' }, { kind: 'pick', ref: 'S' },
  { kind: 'pick', ref: 'F' }, { kind: 'pick', ref: 'F' },
  { kind: 'pick', ref: 'S' },
];

// 선픽 팀을 받아 실제 팀이 채워진 16스텝 시퀀스를 만든다.
export function buildSequence(firstPick: Team): Step[] {
  const F: Team = firstPick;
  const S: Team = firstPick === 'blue' ? 'red' : 'blue';
  return TEMPLATE.map(({ kind, ref }) => ({ kind, team: ref === 'F' ? F : S }));
}
