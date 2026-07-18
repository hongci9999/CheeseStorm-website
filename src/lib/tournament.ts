// 대회(스트리머 대회) 스크림 정리 — 팀 로스터 설정 + matches 자동 분류 + 집계.
// 팀 로스터는 대회마다 한 번 정해지므로 DB 대신 코드 상수로 관리한다 (수정 = 커밋).
// 경기 데이터는 기존 matches 컬렉션을 재사용: 진영 5명 중 3명 이상이
// 한 팀 로스터에 속하면 그 팀의 경기로 자동 분류한다 (용병 1~2명 허용).
import type { Match, Role, Streamer } from './types';
import { roleOfHero } from './heroes';
import { mapImageUrl } from './draft/map-image';

// ── 설정 ─────────────────────────────────────────────────────

export interface TournamentTeamConfig {
  id: string;        // 고정 식별자 (통계 키)
  name: string;      // 표시 이름 (예: '1팀')
  captain: string;   // 팀장 스트리머 이름 — streamers.name과 정확히 일치해야 매칭됨
  members: string[]; // 팀원 4명 이름
}

// 이 날짜 이후의 matches만 대회 스크림 후보로 취급 (과거 내전 제외)
export const TOURNAMENT_START = new Date('2026-07-01');

// TODO: 팀 확정 시 실제 스트리머 이름으로 채울 것 (빈 문자열 = 미정)
export const TOURNAMENT_TEAMS: TournamentTeamConfig[] = [
  { id: 'team1', name: '1팀', captain: '', members: ['', '', '', ''] },
  { id: 'team2', name: '2팀', captain: '', members: ['', '', '', ''] },
  { id: 'team3', name: '3팀', captain: '', members: ['', '', '', ''] },
  { id: 'team4', name: '4팀', captain: '', members: ['', '', '', ''] },
];

// 게임 카드 영웅 배치 순서 (탱커 → 투사 → 암살자 → 전문가 → 지원가)
export const POSITION_ORDER: Role[] = ['탱커', '투사', '암살자', '전문가', '지원가'];

// 분류 기준: 진영 5명 중 로스터 일치 최소 인원
const MIN_ROSTER_MATCH = 3;

// ── 로스터 해석 ──────────────────────────────────────────────

export interface TeamRoster {
  id: string;
  name: string;
  captain: { name: string; streamer: Streamer | null };
  members: { name: string; streamer: Streamer | null }[];
  ids: Set<string>; // 매칭된 스트리머 ID 전체 (팀장 포함)
}

export function resolveTeams(
  streamers: Streamer[],
  config: TournamentTeamConfig[] = TOURNAMENT_TEAMS,
): TeamRoster[] {
  const byName = new Map(streamers.map((s) => [s.name, s]));
  return config.map((c) => {
    const captain = { name: c.captain, streamer: byName.get(c.captain) ?? null };
    const members = c.members.map((n) => ({ name: n, streamer: byName.get(n) ?? null }));
    const ids = new Set(
      [captain, ...members].map((m) => m.streamer?.id).filter((id): id is string => !!id),
    );
    return { id: c.id, name: c.name, captain, members, ids };
  });
}

// ── 경기 분류 ────────────────────────────────────────────────

export interface TournamentGame {
  match: Match;
  no: number; // 스크림 번호 — 날짜·입력 순 오름차순 1부터
  teams: Record<'blue' | 'red', string>; // 버킷 → teamId
}

export function classifyGames(
  matches: Match[],
  rosters: TeamRoster[],
  start: Date = TOURNAMENT_START,
): TournamentGame[] {
  const teamOf = (side: [string, string][]): string | null => {
    for (const r of rosters) {
      if (r.ids.size === 0) continue;
      const hit = side.filter(([id]) => r.ids.has(id)).length;
      if (hit >= MIN_ROSTER_MATCH) return r.id;
    }
    return null;
  };
  return matches
    .filter((m) => m.date >= start)
    .map((m) => ({ m, blue: teamOf(m.blueTeam), red: teamOf(m.redTeam) }))
    .filter((x): x is { m: Match; blue: string; red: string } =>
      !!x.blue && !!x.red && x.blue !== x.red)
    .sort((a, b) => a.m.date.getTime() - b.m.date.getTime()
      || a.m.createdAt.getTime() - b.m.createdAt.getTime())
    .map((x, i) => ({ match: x.m, no: i + 1, teams: { blue: x.blue, red: x.red } }));
}

// ── 팀별 전적 ────────────────────────────────────────────────

export interface TeamRecord {
  teamId: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number; // 양수 = 연승, 음수 = 연패, 0 = 경기 없음
}

export function teamRecords(games: TournamentGame[], rosters: TeamRoster[]): TeamRecord[] {
  const acc = new Map<string, { games: number; wins: number; results: boolean[] }>();
  for (const r of rosters) acc.set(r.id, { games: 0, wins: 0, results: [] });
  for (const g of games) { // games는 시간 오름차순 전제
    for (const bucket of ['blue', 'red'] as const) {
      const a = acc.get(g.teams[bucket]);
      if (!a) continue;
      const won = g.match.winner === bucket;
      a.games++;
      if (won) a.wins++;
      a.results.push(won);
    }
  }
  return rosters.map((r) => {
    const a = acc.get(r.id)!;
    let streak = 0;
    for (let i = a.results.length - 1; i >= 0; i--) {
      const w = a.results[i];
      if (i === a.results.length - 1) streak = w ? 1 : -1;
      else if (w === a.results[i + 1]) streak += w ? 1 : -1;
      else break;
    }
    return {
      teamId: r.id, games: a.games, wins: a.wins, losses: a.games - a.wins,
      winRate: a.games ? a.wins / a.games : 0, streak,
    };
  });
}

// ── 팀 간 상대전적 ───────────────────────────────────────────

export interface H2HRecord { wins: number; losses: number; }

// 키 `${aId}|${bId}` = a 관점 전적. 양방향 모두 기록.
export function headToHead(games: TournamentGame[]): Map<string, H2HRecord> {
  const acc = new Map<string, H2HRecord>();
  const bump = (a: string, b: string, won: boolean) => {
    const key = `${a}|${b}`;
    const r = acc.get(key) ?? { wins: 0, losses: 0 };
    if (won) r.wins++; else r.losses++;
    acc.set(key, r);
  };
  for (const g of games) {
    const blueWon = g.match.winner === 'blue';
    bump(g.teams.blue, g.teams.red, blueWon);
    bump(g.teams.red, g.teams.blue, !blueWon);
  }
  return acc;
}

// ── 포지션(역할군)별 선수 통계 ───────────────────────────────

export interface PositionRow {
  streamerId: string;
  role: Role;
  games: number;
  wins: number;
  winRate: number;
  kda: number | null;   // (K+A)/max(1,D) — 스탯 있는 경기만
  kp: number | null;    // 킬 관여 = (K+A)/팀 킬 합
  heroDmgPerMin: number | null;
  siegeDmgPerMin: number | null;
  healingPerMin: number | null;
  xpPerMin: number | null;
}

// "MM:SS" → 분. 파싱 불가 시 null.
function durMinutes(dur?: string): number | null {
  const m = dur?.trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  const v = Number(m[1]) + Number(m[2]) / 60;
  return v > 0 ? v : null;
}

export function positionStats(games: TournamentGame[]): PositionRow[] {
  interface Acc {
    games: number; wins: number;
    k: number; a: number; d: number; teamKills: number; statGames: number;
    heroDmg: number; siegeDmg: number; healing: number; xp: number; durMin: number;
  }
  const acc = new Map<string, Acc>(); // key = `${id}|${role}`
  const get = (key: string): Acc => {
    let v = acc.get(key);
    if (!v) {
      v = { games: 0, wins: 0, k: 0, a: 0, d: 0, teamKills: 0, statGames: 0,
        heroDmg: 0, siegeDmg: 0, healing: 0, xp: 0, durMin: 0 };
      acc.set(key, v);
    }
    return v;
  };

  for (const g of games) {
    const m = g.match;
    const dur = durMinutes(m.dur);
    for (const bucket of ['blue', 'red'] as const) {
      const roster = bucket === 'blue' ? m.blueTeam : m.redTeam;
      const stats = bucket === 'blue' ? m.blueStats : m.redStats;
      const won = m.winner === bucket;
      const teamKills = stats?.reduce((s, x) => s + x.kills, 0) ?? 0;
      roster.forEach(([id, hero], i) => {
        const role = roleOfHero(hero);
        if (!role) return;
        const v = get(`${id}|${role}`);
        v.games++;
        if (won) v.wins++;
        const st = stats?.[i];
        if (!st) return;
        v.statGames++;
        v.k += st.kills; v.a += st.assists; v.d += st.deaths;
        v.teamKills += teamKills;
        if (dur) {
          v.heroDmg += st.heroDmg; v.siegeDmg += st.siegeDmg;
          v.healing += st.healing; v.xp += st.xp; v.durMin += dur;
        }
      });
    }
  }

  return [...acc.entries()].map(([key, v]) => {
    const [streamerId, role] = key.split('|') as [string, Role];
    const perMin = (sum: number) => (v.durMin > 0 ? sum / v.durMin : null);
    return {
      streamerId, role,
      games: v.games, wins: v.wins, winRate: v.games ? v.wins / v.games : 0,
      kda: v.statGames ? (v.k + v.a) / Math.max(1, v.d) : null,
      kp: v.teamKills > 0 ? (v.k + v.a) / v.teamKills : null,
      heroDmgPerMin: perMin(v.heroDmg),
      siegeDmgPerMin: perMin(v.siegeDmg),
      healingPerMin: perMin(v.healing),
      xpPerMin: perMin(v.xp),
    };
  }).sort((x, y) => y.games - x.games || y.winRate - x.winRate);
}

// ── 뷰모델 (서버에서 계산해 클라이언트로 직렬화 전달) ────────

export interface MemberVM { name: string; img?: string; resolved: boolean; }
export interface TeamVM {
  id: string; name: string;
  captain: MemberVM; members: MemberVM[];
  games: number; wins: number; losses: number; winRate: number; streak: number;
}
export interface H2HCellVM { wins: number; losses: number; games: number; winRate: number; }
export interface PlayerVM {
  name: string; gameName?: string; hero: string;
  kda?: string; // "K/D/A" 문자열 — 스탯 없으면 undefined
}
export interface SideVM { teamName: string; won: boolean; firstPick: boolean; players: PlayerVM[]; }
export interface GameVM {
  id: string; no: number; dateLabel: string;
  map?: string; mapImg: string | null; dur?: string;
  left: SideVM; right: SideVM;
  firstPickKnown: boolean;
}
export interface PositionRowVM {
  name: string; img?: string; teamName: string;
  games: number; wins: number; winRate: number;
  kda: number | null; kp: number | null;
  heroDmgPerMin: number | null; siegeDmgPerMin: number | null;
  healingPerMin: number | null; xpPerMin: number | null;
}
export interface TournamentData {
  configured: boolean; // 로스터가 하나라도 실제 스트리머와 매칭됐는지
  teams: TeamVM[];
  teamNames: Record<string, string>;
  h2h: (H2HCellVM | null)[][]; // [행 팀][열 팀], 같은 팀 = null
  games: GameVM[]; // 최신순
  positions: { role: Role; rows: PositionRowVM[] }[];
}

const dateLabel = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

// 게임 카드용 슬롯 정렬 — 탱커→투사→암살자→전문가→지원가, 미상 역할은 뒤로.
export function sortByPosition(roster: [string, string][]): [string, string][] {
  const idx = (hero: string) => {
    const r = roleOfHero(hero);
    return r ? POSITION_ORDER.indexOf(r) : POSITION_ORDER.length;
  };
  return [...roster].sort((a, b) => idx(a[1]) - idx(b[1]));
}

export function buildTournamentData(
  matches: Match[],
  streamers: Streamer[],
  config: TournamentTeamConfig[] = TOURNAMENT_TEAMS,
  start: Date = TOURNAMENT_START,
): TournamentData {
  const rosters = resolveTeams(streamers, config);
  const configured = rosters.some((r) => r.ids.size > 0);
  const games = classifyGames(matches, rosters, start);
  const records = new Map(teamRecords(games, rosters).map((r) => [r.teamId, r]));
  const h2hMap = headToHead(games);
  const byId = new Map(streamers.map((s) => [s.id, s]));
  const teamNames = Object.fromEntries(rosters.map((r) => [r.id, r.name]));

  const memberVM = (m: { name: string; streamer: Streamer | null }): MemberVM => ({
    name: m.streamer?.name || m.name || '미정',
    img: m.streamer?.profileImageUrl,
    resolved: !!m.streamer,
  });

  const teams: TeamVM[] = rosters.map((r) => {
    const rec = records.get(r.id)!;
    return {
      id: r.id, name: r.name,
      captain: memberVM(r.captain), members: r.members.map(memberVM),
      games: rec.games, wins: rec.wins, losses: rec.losses,
      winRate: rec.winRate, streak: rec.streak,
    };
  });

  const h2h = rosters.map((row) => rosters.map((col) => {
    if (row.id === col.id) return null;
    const r = h2hMap.get(`${row.id}|${col.id}`);
    if (!r) return null;
    const g = r.wins + r.losses;
    return { wins: r.wins, losses: r.losses, games: g, winRate: g ? r.wins / g : 0 };
  }));

  const sideVM = (g: TournamentGame, bucket: 'blue' | 'red'): SideVM => {
    const m = g.match;
    const roster = bucket === 'blue' ? m.blueTeam : m.redTeam;
    const stats = bucket === 'blue' ? m.blueStats : m.redStats;
    const statBySlot = new Map(roster.map(([id], i) => [id, stats?.[i]]));
    return {
      teamName: teamNames[g.teams[bucket]] ?? '?',
      won: m.winner === bucket,
      firstPick: m.firstPick === bucket,
      players: sortByPosition(roster).map(([id, hero]) => {
        const s = byId.get(id);
        const st = statBySlot.get(id);
        return {
          name: s?.name ?? id, gameName: s?.gameNames?.[0], hero,
          kda: st ? `${st.kills}/${st.deaths}/${st.assists}` : undefined,
        };
      }),
    };
  };

  const gameVMs: GameVM[] = [...games].reverse().map((g) => {
    const m = g.match;
    // 선픽팀을 왼쪽에 — 미지정이면 blue 버킷 왼쪽
    const leftBucket: 'blue' | 'red' = m.firstPick === 'red' ? 'red' : 'blue';
    const rightBucket = leftBucket === 'blue' ? 'red' : 'blue';
    return {
      id: m.id, no: g.no, dateLabel: dateLabel(m.date),
      map: m.map, mapImg: m.map ? mapImageUrl(m.map) : null, dur: m.dur,
      left: sideVM(g, leftBucket), right: sideVM(g, rightBucket),
      firstPickKnown: !!m.firstPick,
    };
  });

  // 포지션 테이블 행 — 팀 소속은 로스터 기준, 로스터 밖 참가자는 '용병'
  const teamOfStreamer = (id: string): string => {
    for (const r of rosters) if (r.ids.has(id)) return r.name;
    return '용병';
  };
  const rows = positionStats(games);
  const positions = POSITION_ORDER
    .map((role) => ({
      role,
      rows: rows.filter((r) => r.role === role).map((r) => {
        const s = byId.get(r.streamerId);
        return {
          name: s?.name ?? r.streamerId, img: s?.profileImageUrl,
          teamName: teamOfStreamer(r.streamerId),
          games: r.games, wins: r.wins, winRate: r.winRate,
          kda: r.kda, kp: r.kp,
          heroDmgPerMin: r.heroDmgPerMin, siegeDmgPerMin: r.siegeDmgPerMin,
          healingPerMin: r.healingPerMin, xpPerMin: r.xpPerMin,
        };
      }),
    }))
    .filter((p) => p.rows.length > 0);

  return { configured, teams, teamNames, h2h, games: gameVMs, positions };
}
