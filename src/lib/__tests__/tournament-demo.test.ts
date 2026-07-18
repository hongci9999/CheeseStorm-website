import { describe, it, expect } from 'vitest';
import { buildDemoTournamentData } from '../tournament-demo';

describe('buildDemoTournamentData', () => {
  it('4팀 24경기 더미가 실제 파이프라인을 통과한다', () => {
    const data = buildDemoTournamentData();
    expect(data.demo).toBe(true);
    expect(data.configured).toBe(true);
    expect(data.teams).toHaveLength(4);
    expect(data.games).toHaveLength(24);
    // 모든 경기에 10명 전원 KDA 스탯 존재
    for (const g of data.games) {
      expect(g.left.players).toHaveLength(5);
      expect(g.right.players).toHaveLength(5);
      for (const p of [...g.left.players, ...g.right.players]) expect(p.kda).toBeTruthy();
    }
    // 포지션 통계: 탱/투/암/힐 4개 역할군 존재 (전문가는 더미 조합에 없음)
    expect(data.positions.map((p) => p.role)).toEqual(['탱커', '투사', '암살자', '지원가']);
    // 시드 고정 — 두 번 생성해도 동일
    const again = buildDemoTournamentData();
    expect(again.games[0]).toEqual(data.games[0]);
  });
});
