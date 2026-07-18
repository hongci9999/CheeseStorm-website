import { describe, it, expect } from 'vitest';
import {
  resolveTeams, classifyGames, teamRecords, headToHead, positionStats,
  sortByPosition, buildTournamentData,
  type TournamentTeamConfig,
} from '../tournament';
import type { Match, PlayerMatchStat, Streamer } from '../types';

// ── 픽스처 ───────────────────────────────────────────────────

const mkStreamer = (id: string, name: string): Streamer => ({
  id, name, gameNames: [`${name}#1234`], createdAt: new Date('2026-01-01'),
});

// 팀A: a0(팀장)~a4 / 팀B: b0(팀장)~b4
const streamers: Streamer[] = [
  ...['a0', 'a1', 'a2', 'a3', 'a4'].map((id) => mkStreamer(id, `선수${id}`)),
  ...['b0', 'b1', 'b2', 'b3', 'b4'].map((id) => mkStreamer(id, `선수${id}`)),
  mkStreamer('x0', '용병X'),
];

const config: TournamentTeamConfig[] = [
  { id: 'A', name: 'A팀', captain: '선수a0', members: ['선수a1', '선수a2', '선수a3', '선수a4'] },
  { id: 'B', name: 'B팀', captain: '선수b0', members: ['선수b1', '선수b2', '선수b3', '선수b4'] },
];

const stat = (kills: number, deaths: number, assists: number, over: Partial<PlayerMatchStat> = {}): PlayerMatchStat => ({
  kills, assists, deaths, siegeDmg: 0, heroDmg: 0, healing: 0, selfHeal: 0, xp: 0, ...over,
});

let seq = 0;
function mkMatch(over: Partial<Match>): Match {
  seq++;
  return {
    id: `m${seq}`,
    date: new Date('2026-07-10'),
    blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['a2', '제이나'], ['a3', '아바투르'], ['a4', '리 리']],
    redTeam: [['b0', '디아블로'], ['b1', '아르타니스'], ['b2', '발라'], ['b3', '자가라'], ['b4', '우서']],
    winner: 'blue',
    createdAt: new Date(2026, 6, 10, 0, 0, seq),
    ...over,
  };
}

const rosters = resolveTeams(streamers, config);

// ── 로스터 해석 ──────────────────────────────────────────────

describe('resolveTeams', () => {
  it('이름으로 스트리머를 매칭하고 미등록 이름은 null', () => {
    const r = resolveTeams(streamers, [
      { id: 'T', name: 'T팀', captain: '선수a0', members: ['없는사람', '선수b1', '', ''] },
    ]);
    expect(r[0].captain.streamer?.id).toBe('a0');
    expect(r[0].members[0].streamer).toBeNull();
    expect(r[0].ids).toEqual(new Set(['a0', 'b1']));
  });
});

// ── 경기 분류 ────────────────────────────────────────────────

describe('classifyGames', () => {
  it('진영 5명 중 3명 이상 로스터 일치 시 그 팀으로 분류 (용병 2명 허용)', () => {
    const m = mkMatch({
      blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['a2', '제이나'], ['x0', '아바투르'], ['b4', '리 리']],
    });
    const games = classifyGames([m], rosters);
    expect(games).toHaveLength(1);
    expect(games[0].teams).toEqual({ blue: 'A', red: 'B' });
  });

  it('로스터 일치 2명 이하면 분류 제외', () => {
    const m = mkMatch({
      blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['x0', '제이나'], ['x0', '아바투르'], ['x0', '리 리']],
    });
    expect(classifyGames([m], rosters)).toHaveLength(0);
  });

  it('TOURNAMENT_START 이전 경기는 제외', () => {
    const m = mkMatch({ date: new Date('2026-06-01') });
    expect(classifyGames([m], rosters, new Date('2026-07-01'))).toHaveLength(0);
  });

  it('스크림 번호는 날짜·입력 순 오름차순 1부터', () => {
    const m1 = mkMatch({ date: new Date('2026-07-12') });
    const m2 = mkMatch({ date: new Date('2026-07-11') });
    const games = classifyGames([m1, m2], rosters);
    expect(games.map((g) => [g.no, g.match.id])).toEqual([[1, m2.id], [2, m1.id]]);
  });
});

// ── 팀 전적 · 연속 ───────────────────────────────────────────

describe('teamRecords', () => {
  it('승패·승률·연속(연승/연패)을 계산한다', () => {
    // A 기준: 승, 승, 패 → 1연패 중
    const games = classifyGames([
      mkMatch({ date: new Date('2026-07-10'), winner: 'blue' }),
      mkMatch({ date: new Date('2026-07-11'), winner: 'blue' }),
      mkMatch({ date: new Date('2026-07-12'), winner: 'red' }),
    ], rosters);
    const rec = new Map(teamRecords(games, rosters).map((r) => [r.teamId, r]));
    expect(rec.get('A')).toMatchObject({ games: 3, wins: 2, losses: 1, streak: -1 });
    expect(rec.get('B')).toMatchObject({ games: 3, wins: 1, losses: 2, streak: 1 });
    expect(rec.get('A')!.winRate).toBeCloseTo(2 / 3);
  });
});

// ── 상대전적 ─────────────────────────────────────────────────

describe('headToHead', () => {
  it('양방향 대칭 기록', () => {
    const games = classifyGames([
      mkMatch({ winner: 'blue' }), mkMatch({ winner: 'blue' }), mkMatch({ winner: 'red' }),
    ], rosters);
    const h = headToHead(games);
    expect(h.get('A|B')).toEqual({ wins: 2, losses: 1 });
    expect(h.get('B|A')).toEqual({ wins: 1, losses: 2 });
  });
});

// ── 포지션 통계 ──────────────────────────────────────────────

describe('positionStats', () => {
  it('역할군별 KDA·KP·분당 지표를 집계한다', () => {
    const m = mkMatch({
      dur: '20:00',
      blueStats: [
        stat(4, 2, 6, { heroDmg: 40000 }), // a0 무라딘(탱커)
        stat(2, 1, 3), stat(6, 0, 4), stat(0, 1, 2), stat(0, 2, 8),
      ],
    });
    const games = classifyGames([m], rosters);
    const rows = positionStats(games);
    const a0 = rows.find((r) => r.streamerId === 'a0');
    expect(a0).toBeDefined();
    expect(a0!.role).toBe('탱커');
    expect(a0!.games).toBe(1);
    expect(a0!.wins).toBe(1);
    expect(a0!.kda).toBeCloseTo((4 + 6) / 2);
    // 팀 킬 합 = 4+2+6+0+0 = 12 → KP = (4+6)/12
    expect(a0!.kp).toBeCloseTo(10 / 12);
    expect(a0!.heroDmgPerMin).toBeCloseTo(40000 / 20);
  });

  it('스탯 없는 경기는 승패만 집계하고 KDA는 null', () => {
    const games = classifyGames([mkMatch({})], rosters);
    const a0 = positionStats(games).find((r) => r.streamerId === 'a0');
    expect(a0!.games).toBe(1);
    expect(a0!.kda).toBeNull();
    expect(a0!.kp).toBeNull();
  });
});

// ── 영웅 배치 순서 ───────────────────────────────────────────

describe('sortByPosition', () => {
  it('탱커→투사→암살자→전문가→지원가 순 정렬', () => {
    const sorted = sortByPosition([
      ['p1', '리 리'],      // 지원가
      ['p2', '발라'],       // 암살자
      ['p3', '무라딘'],     // 탱커
      ['p4', '아바투르'],   // 전문가
      ['p5', '소냐'],       // 투사
    ]);
    expect(sorted.map(([, h]) => h)).toEqual(['무라딘', '소냐', '발라', '아바투르', '리 리']);
  });
});

// ── 뷰모델 통합 ──────────────────────────────────────────────

describe('buildTournamentData', () => {
  it('선픽팀을 왼쪽에 배치하고 최신순으로 반환', () => {
    const m1 = mkMatch({ date: new Date('2026-07-10'), firstPick: 'red' });
    const m2 = mkMatch({ date: new Date('2026-07-11') });
    const data = buildTournamentData([m1, m2], streamers, config);
    expect(data.configured).toBe(true);
    expect(data.games.map((g) => g.no)).toEqual([2, 1]); // 최신순
    const g1 = data.games.find((g) => g.no === 1)!;
    expect(g1.firstPickKnown).toBe(true);
    expect(g1.left.teamName).toBe('B팀'); // firstPick=red → red 버킷이 왼쪽
    expect(g1.left.firstPick).toBe(true);
    const g2 = data.games.find((g) => g.no === 2)!;
    expect(g2.firstPickKnown).toBe(false);
    expect(g2.left.teamName).toBe('A팀'); // 미지정 → blue 왼쪽
  });

  it('로스터 미설정이면 configured=false, 경기 0', () => {
    const empty = [{ id: 'T', name: 'T팀', captain: '', members: ['', '', '', ''] }];
    const data = buildTournamentData([mkMatch({})], streamers, empty);
    expect(data.configured).toBe(false);
    expect(data.games).toHaveLength(0);
  });
});
