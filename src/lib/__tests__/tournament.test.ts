import { describe, it, expect } from 'vitest';
import {
  resolveTeams, linkTournamentGames, teamRecords, headToHead, positionStats,
  sortByPosition, buildTournamentData, mapRecords, teamMapRecords, guessTournamentTeams,
  type TournamentTeamConfig, type TournamentGameLink,
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

// 경기 입력 시점에 남기는 명시적 태그 — 기본 A(blue)/B(red).
function mkLink(m: Match, blueTeamId = 'A', redTeamId = 'B'): TournamentGameLink {
  return { matchId: m.id, blueTeamId, redTeamId, createdAt: m.createdAt };
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

// ── 경기 연결(태깅) ──────────────────────────────────────────

describe('linkTournamentGames', () => {
  it('명시적으로 태깅된 경기만 채택한다 — 로스터 겹침과 무관', () => {
    // 참가자가 로스터와 전혀 안 겹쳐도(용병만 뛴 경기) 태그만 있으면 채택된다.
    const m = mkMatch({
      blueTeam: [['x0', '무라딘'], ['x0', '소냐'], ['x0', '제이나'], ['x0', '아바투르'], ['x0', '리 리']],
    });
    const games = linkTournamentGames([m], [mkLink(m)]);
    expect(games).toHaveLength(1);
    expect(games[0].teams).toEqual({ blue: 'A', red: 'B' });
  });

  it('태그 없는 경기는 제외된다', () => {
    const tagged = mkMatch({});
    const untagged = mkMatch({});
    const games = linkTournamentGames([tagged, untagged], [mkLink(tagged)]);
    expect(games.map((g) => g.match.id)).toEqual([tagged.id]);
  });

  it('스크림 번호는 날짜·입력 순 오름차순 1부터', () => {
    const m1 = mkMatch({ date: new Date('2026-07-12') });
    const m2 = mkMatch({ date: new Date('2026-07-11') });
    const games = linkTournamentGames([m1, m2], [mkLink(m1), mkLink(m2)]);
    expect(games.map((g) => [g.no, g.match.id])).toEqual([[1, m2.id], [2, m1.id]]);
  });
});

// ── 팀 전적 · 연속 ───────────────────────────────────────────

describe('teamRecords', () => {
  it('승패·승률·연속(연승/연패)을 계산한다', () => {
    // A 기준: 승, 승, 패 → 1연패 중
    const matches = [
      mkMatch({ date: new Date('2026-07-10'), winner: 'blue' }),
      mkMatch({ date: new Date('2026-07-11'), winner: 'blue' }),
      mkMatch({ date: new Date('2026-07-12'), winner: 'red' }),
    ];
    const games = linkTournamentGames(matches, matches.map((m) => mkLink(m)));
    const rec = new Map(teamRecords(games, rosters).map((r) => [r.teamId, r]));
    expect(rec.get('A')).toMatchObject({ games: 3, wins: 2, losses: 1, streak: -1 });
    expect(rec.get('B')).toMatchObject({ games: 3, wins: 1, losses: 2, streak: 1 });
    expect(rec.get('A')!.winRate).toBeCloseTo(2 / 3);
  });
});

// ── 상대전적 ─────────────────────────────────────────────────

describe('headToHead', () => {
  it('양방향 대칭 기록', () => {
    const matches = [
      mkMatch({ winner: 'blue' }), mkMatch({ winner: 'blue' }), mkMatch({ winner: 'red' }),
    ];
    const games = linkTournamentGames(matches, matches.map((m) => mkLink(m)));
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
    const games = linkTournamentGames([m], [mkLink(m)]);
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
    const m = mkMatch({});
    const games = linkTournamentGames([m], [mkLink(m)]);
    const a0 = positionStats(games).find((r) => r.streamerId === 'a0');
    expect(a0!.games).toBe(1);
    expect(a0!.kda).toBeNull();
    expect(a0!.kp).toBeNull();
  });
});

// ── 맵별 통계 ────────────────────────────────────────────────

describe('mapRecords', () => {
  it('선픽 팀 승률을 맵별로 집계하고 미기록 선픽은 분모에서 제외', () => {
    const matches = [
      mkMatch({ map: '용의 둥지', firstPick: 'blue', winner: 'blue' }), // 선픽 승
      mkMatch({ map: '용의 둥지', firstPick: 'red', winner: 'blue' }),  // 선픽 패
      mkMatch({ map: '용의 둥지', winner: 'blue' }),                     // 선픽 미기록
    ];
    const games = linkTournamentGames(matches, matches.map((m) => mkLink(m)));
    const rec = mapRecords(games).find((m) => m.map === '용의 둥지')!;
    expect(rec.games).toBe(3);
    expect(rec.firstPickKnown).toBe(2);
    expect(rec.firstPickWins).toBe(1);
    expect(rec.firstPickWinRate).toBeCloseTo(0.5);
  });

  it('선픽이 전부 미기록이면 winRate=null', () => {
    const m = mkMatch({ map: '파멸의 탑' });
    const games = linkTournamentGames([m], [mkLink(m)]);
    const rec = mapRecords(games).find((x) => x.map === '파멸의 탑')!;
    expect(rec.firstPickWinRate).toBeNull();
  });

  it('설정된 6개 맵을 우선 순서로 반환', () => {
    const rec = mapRecords([]);
    expect(rec.slice(0, 6).map((m) => m.map)).toEqual([
      '용의 둥지', '저주받은 골짜기', '거미 여왕의 무덤', '불지옥 신단', '파멸의 탑', '영원의 전쟁터',
    ]);
  });
});

describe('teamMapRecords', () => {
  it('팀별 맵 승률을 집계한다', () => {
    const matches = [
      mkMatch({ map: '용의 둥지', winner: 'blue' }), // A 승
      mkMatch({ map: '용의 둥지', winner: 'red' }),  // A 패
      mkMatch({ map: '파멸의 탑', winner: 'blue' }), // A 승
    ];
    const games = linkTournamentGames(matches, matches.map((m) => mkLink(m)));
    const tm = teamMapRecords(games);
    expect(tm.get('A|용의 둥지')).toEqual({ games: 2, wins: 1, winRate: 0.5 });
    expect(tm.get('B|용의 둥지')).toEqual({ games: 2, wins: 1, winRate: 0.5 });
    expect(tm.get('A|파멸의 탑')).toEqual({ games: 1, wins: 1, winRate: 1 });
    expect(tm.get('B|파멸의 탑')).toEqual({ games: 1, wins: 0, winRate: 0 });
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
    const links = [mkLink(m1), mkLink(m2)];
    const data = buildTournamentData([m1, m2], links, streamers, config);
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

  it('태그된 경기가 없으면 로스터 설정과 무관하게 경기 0', () => {
    const data = buildTournamentData([mkMatch({})], [], streamers, config);
    expect(data.configured).toBe(true); // 로스터 자체는 정상 매칭됨
    expect(data.games).toHaveLength(0); // 그러나 태그가 없어 경기는 0
  });

  it('로스터 밖 대타는 포지션 통계에서 제외하되 팀 승패엔 반영', () => {
    // a2 자리에 로스터 밖 x0가 대타로 출전한 대회 경기
    const m = mkMatch({
      blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['x0', '제이나'], ['a3', '아바투르'], ['a4', '리 리']],
      winner: 'blue',
    });
    const data = buildTournamentData([m], [mkLink(m)], streamers, config);

    const names = data.positions.flatMap((p) => p.rows.map((r) => r.name));
    expect(names).not.toContain('용병X');           // 대타는 개인 통계에서 무시
    expect(names).toContain('선수a0');               // 로스터 인원은 그대로 집계
    expect(names).not.toContain('선수a2');           // 안 뛴 로스터 인원은 행 자체가 없음

    const teamA = data.teams.find((t) => t.id === 'A')!;
    expect(teamA.games).toBe(1);                    // 팀 전적은 대타 출전과 무관
    expect(teamA.wins).toBe(1);
  });

  it('타팀 대타 출전은 그 선수 개인 통계에 합산되지 않는다', () => {
    // b4가 자기 팀(B) 대신 A팀 진영에 대타로 출전, B팀 자리는 외부 용병 x0가 채움
    const m = mkMatch({
      blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['a2', '제이나'], ['a3', '아바투르'], ['b4', '리 리']],
      redTeam: [['b0', '디아블로'], ['b1', '아르타니스'], ['b2', '발라'], ['b3', '자가라'], ['x0', '우서']],
      winner: 'blue',
    });
    const data = buildTournamentData([m], [mkLink(m)], streamers, config);

    const rows = data.positions.flatMap((p) => p.rows);
    expect(rows.map((r) => r.name)).not.toContain('선수b4'); // 대타로 딴 승은 개인 통계 밖
    expect(rows.map((r) => r.name)).not.toContain('용병X');
    expect(rows.find((r) => r.name === '선수a0')!.games).toBe(1); // 정상 출전은 그대로
  });

  it('용병 출전자만 게임 카드에 merc 표시', () => {
    const m = mkMatch({
      // x0 = 외부 용병, b4 = 타팀 대타 — 둘 다 A팀 로스터 밖
      blueTeam: [['a0', '무라딘'], ['a1', '소냐'], ['x0', '제이나'], ['b4', '아바투르'], ['a4', '리 리']],
    });
    const data = buildTournamentData([m], [mkLink(m)], streamers, config);

    const all = [...data.games[0].left.players, ...data.games[0].right.players];
    const mercs = all.filter((p) => p.merc).map((p) => p.name);
    expect(mercs.sort()).toEqual(['선수b4', '용병X']);
    expect(all.find((p) => p.name === '선수a0')!.merc).toBeUndefined();
  });

  it('로스터 미설정이면 configured=false', () => {
    const empty = [{ id: 'T', name: 'T팀', captain: '', members: ['', '', '', ''] }];
    const data = buildTournamentData([mkMatch({})], [], streamers, empty);
    expect(data.configured).toBe(false);
    expect(data.games).toHaveLength(0);
  });
});

describe('guessTournamentTeams', () => {
  const A = ['a0', 'a1', 'a2', 'a3', 'a4'];
  const B = ['b0', 'b1', 'b2', 'b3', 'b4'];

  it('정상 로스터면 양 진영을 맞춘다', () => {
    expect(guessTournamentTeams(A, B, streamers, config)).toEqual({ blue: 'A', red: 'B' });
  });

  it('외부 용병이 껴도 다수결로 잡는다', () => {
    const withMerc = ['a0', 'a1', 'a2', 'a3', 'x0'];
    expect(guessTournamentTeams(withMerc, B, streamers, config)).toEqual({ blue: 'A', red: 'B' });
  });

  it('타팀 대타 2명이 껴도 다수결로 잡는다', () => {
    const withSubs = ['a0', 'a1', 'a2', 'b3', 'b4'];
    expect(guessTournamentTeams(withSubs, B, streamers, config)).toEqual({ blue: 'A', red: 'B' });
  });

  it('과반(3명) 미달이면 null', () => {
    const mixed = ['a0', 'a1', 'b3', 'b4', 'x0'];
    expect(guessTournamentTeams(mixed, B, streamers, config)).toBeNull();
  });

  it('양 진영이 같은 팀으로 잡히면 null', () => {
    expect(guessTournamentTeams(A, A, streamers, config)).toBeNull();
  });
});
