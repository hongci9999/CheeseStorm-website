// 대회(스트리머 대회) 스크림 정리 — 팀 로스터 설정 + 명시적 경기 태깅 + 집계.
// 팀 로스터는 대회마다 한 번 정해지므로 DB 대신 코드 상수로 관리한다 (수정 = 커밋).
// 경기 자체는 내전기록실(matches)에 그대로 저장하되, 어느 경기가 대회 경기인지는
// 별도 tournamentGames 컬렉션(TournamentGameLink)에 경기 입력 시점에 명시적으로 기록한다.
// (과거: 날짜+로스터 겹침 휴리스틱으로 자동 분류했으나, 오탐 위험과 대회 시작 전
// 스크림까지 섞이는 문제로 폐기 — 이제 명시적 태깅만 신뢰한다.)
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

// 대회 이름·시즌 — 향후 다른 대회 기록 시 여기와 TOURNAMENT_TEAMS를 갱신
// (대회가 2개 이상 쌓이면 배열 구조로 리팩터링)
export const TOURNAMENT_NAME = '히오스는 살아있다';
export const TOURNAMENT_SEASON = '2026 여름 시즌';

// 대회 진행 기간 — 표시용(페이지 부제) + 루트 rewrite 판정용. 경기 분류는 날짜가 아니라
// 명시적 태깅(TournamentGameLink)으로 결정된다. 상수·판정은 Edge 안전한 tournament-period로 분리.
export { TOURNAMENT_START, TOURNAMENT_END, isTournamentActive } from './tournament-period';

// 팀장·팀원 전원 확정 (드래프트 완료).
export const TOURNAMENT_TEAMS: TournamentTeamConfig[] = [
  { id: 'team1', name: '1팀', captain: '베릴',     members: ['룩삼', '뱅', '노페', '플레임'] },
  { id: 'team2', name: '2팀', captain: '진수',     members: ['끠월마녀', '헤징', '침착맨', '철면수심'] },
  { id: 'team3', name: '3팀', captain: '인간젤리', members: ['울프', '츠밍', '던', '반님'] },
  { id: 'team4', name: '4팀', captain: '네클릿',   members: ['소우릎', '캡틴잭', '강소연', '승우아빠'] },
];

// 대회 참가자 전원 이름 (팀장+팀원) — 티어리스트·스트리머 페이지 "대회 참가자만 보기" 필터용
export const TOURNAMENT_PARTICIPANT_NAMES: string[] =
  TOURNAMENT_TEAMS.flatMap((t) => [t.captain, ...t.members]);

// 이번 대회 사용 맵 6종 (맵별 통계 표시 순서)
export const TOURNAMENT_MAPS = [
  '용의 둥지', '저주받은 골짜기', '거미 여왕의 무덤',
  '불지옥 신단', '파멸의 탑', '영원의 전쟁터',
] as const;

// 게임 카드 영웅 배치 순서 (탱커 → 투사 → 암살자 → 전문가 → 지원가)
export const POSITION_ORDER: Role[] = ['탱커', '투사', '암살자', '전문가', '지원가'];

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

// 출전자 소속 다수결로 각 진영의 대회팀을 추정 — 경기 입력 시 드롭다운 자동 선택용.
// 용병(대타)이 껴도 소속 인원이 더 많은 쪽이 그 진영의 팀. 5명 중 3명 이상이면
// 한 진영에서 조건을 만족하는 팀은 최대 하나뿐이라 동점 자체가 불가능하다.
// 확신 못 하면 null — 사람이 드롭다운으로 직접 고른다.
// ponytail: 임계값 3 고정. 대타 3명 이상 경기가 생기면 그때 완화.
export function guessTournamentTeams(
  blueIds: string[],
  redIds: string[],
  streamers: Streamer[],
  config: TournamentTeamConfig[] = TOURNAMENT_TEAMS,
): { blue: string; red: string } | null {
  const teamOf = new Map<string, string>();
  for (const r of resolveTeams(streamers, config)) for (const id of r.ids) teamOf.set(id, r.id);
  const majority = (ids: string[]): string | null => {
    const count = new Map<string, number>();
    for (const id of ids) {
      const t = teamOf.get(id);
      if (t) count.set(t, (count.get(t) ?? 0) + 1);
    }
    for (const [t, n] of count) if (n >= 3) return t;
    return null;
  };
  const blue = majority(blueIds);
  const red = majority(redIds);
  return blue && red && blue !== red ? { blue, red } : null;
}

// ── 경기 연결(태깅) ──────────────────────────────────────────

export interface TournamentGame {
  match: Match;
  no: number; // 스크림 번호 — 날짜·입력 순 오름차순 1부터
  teams: Record<'blue' | 'red', string>; // 버킷 → teamId
}

// tournamentGames 컬렉션 문서 — 경기 입력 시점에 명시적으로 남기는 대회 소속 태그.
// 문서 id = matchId(1:1) — 경기 하나는 최대 한 대회에만 속한다.
export interface TournamentGameLink {
  matchId: string;
  blueTeamId: string;
  redTeamId: string;
  createdAt: Date;
}

// 명시적으로 태깅된 경기만 대회 데이터로 채택 — 날짜·로스터 겹침 추정 없음.
export function linkTournamentGames(
  matches: Match[],
  links: TournamentGameLink[],
): TournamentGame[] {
  const linkByMatchId = new Map(links.map((l) => [l.matchId, l]));
  return matches
    .map((m) => ({ m, link: linkByMatchId.get(m.id) }))
    .filter((x): x is { m: Match; link: TournamentGameLink } => !!x.link)
    .sort((a, b) => a.m.date.getTime() - b.m.date.getTime()
      || a.m.createdAt.getTime() - b.m.createdAt.getTime())
    .map((x, i) => ({
      match: x.m, no: i + 1,
      teams: { blue: x.link.blueTeamId, red: x.link.redTeamId },
    }));
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

// ── 맵별 통계 ────────────────────────────────────────────────

export interface MapRecord {
  map: string;
  games: number;
  firstPickWins: number;   // 선픽(firstPick) 팀이 이긴 경기 수
  firstPickKnown: number;  // 선픽 팀이 기록된 경기 수 (승률 분모)
  firstPickWinRate: number | null; // 선픽 미기록만 있으면 null
}

// 설정된 6개 맵 순서로 반환 — 기록 없는 맵도 0으로 노출.
export function mapRecords(games: TournamentGame[]): MapRecord[] {
  const acc = new Map<string, { games: number; fpWins: number; fpKnown: number }>();
  for (const g of games) {
    const map = g.match.map;
    if (!map) continue;
    const a = acc.get(map) ?? { games: 0, fpWins: 0, fpKnown: 0 };
    a.games++;
    const fp = g.match.firstPick;
    if (fp) {
      a.fpKnown++;
      if (g.match.winner === fp) a.fpWins++;
    }
    acc.set(map, a);
  }
  // 설정 맵 우선 정렬, 그 외 기록된 맵은 뒤에 경기수 내림차순
  const order = new Map(TOURNAMENT_MAPS.map((m, i) => [m as string, i]));
  const keys = new Set([...TOURNAMENT_MAPS, ...acc.keys()]);
  return [...keys]
    .map((map) => {
      const a = acc.get(map) ?? { games: 0, fpWins: 0, fpKnown: 0 };
      return {
        map, games: a.games, firstPickWins: a.fpWins, firstPickKnown: a.fpKnown,
        firstPickWinRate: a.fpKnown ? a.fpWins / a.fpKnown : null,
      };
    })
    .sort((x, y) => {
      const ox = order.has(x.map) ? order.get(x.map)! : 999;
      const oy = order.has(y.map) ? order.get(y.map)! : 999;
      return ox - oy || y.games - x.games || x.map.localeCompare(y.map, 'ko');
    });
}

// ── 팀별 맵 승률 ─────────────────────────────────────────────

export interface TeamMapCell { games: number; wins: number; winRate: number | null; }

// key `${teamId}|${map}` = 그 팀이 그 맵에서 거둔 전적.
export function teamMapRecords(games: TournamentGame[]): Map<string, TeamMapCell> {
  const acc = new Map<string, { games: number; wins: number }>();
  for (const g of games) {
    const map = g.match.map;
    if (!map) continue;
    for (const bucket of ['blue', 'red'] as const) {
      const key = `${g.teams[bucket]}|${map}`;
      const a = acc.get(key) ?? { games: 0, wins: 0 };
      a.games++;
      if (g.match.winner === bucket) a.wins++;
      acc.set(key, a);
    }
  }
  const out = new Map<string, TeamMapCell>();
  for (const [key, a] of acc) out.set(key, { games: a.games, wins: a.wins, winRate: a.games ? a.wins / a.games : null });
  return out;
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

// rosters를 주면 용병(대타) 출전은 개인 통계에서 제외한다 — 그 진영의 대회팀 로스터에
// 없는 id는 건너뜀. 외부 용병뿐 아니라 타팀 대타도 걸러져 자기 팀 경기 성적만 남는다.
export function positionStats(games: TournamentGame[], rosters?: TeamRoster[]): PositionRow[] {
  const idsByTeam = new Map(rosters?.map((r) => [r.id, r.ids]) ?? []);
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
      const own = idsByTeam.get(g.teams[bucket]);
      roster.forEach(([id, hero], i) => {
        if (own && !own.has(id)) return; // 용병 출전은 개인 통계 제외
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
  kda?: string;          // "K/D/A" 문자열 — 스탯 없으면 undefined
  barKind?: 'dmg' | 'heal'; // 힐러=heal(치유량), 그 외=dmg(영웅딜)
  barValue?: number;     // 막대 원값 (딜 또는 힐)
  barLabel?: string;     // 축약 표기 (예: "42.3k")
  merc?: boolean;        // 용병(대타) — 이 진영의 대회팀 로스터에 없는 출전자
}
export interface SideVM { teamName: string; won: boolean; firstPick: boolean; players: PlayerVM[]; }
export interface GameVM {
  id: string; no: number; dateLabel: string;
  map?: string; mapImg: string | null; dur?: string;
  left: SideVM; right: SideVM;
  firstPickKnown: boolean;
  maxDmg: number;  // 이 경기 내 최대 영웅딜 (막대 정규화 기준)
  maxHeal: number; // 이 경기 내 최대 치유량
}
export interface PositionRowVM {
  name: string; img?: string; teamName: string;
  games: number; wins: number; winRate: number;
  kda: number | null; kp: number | null;
  heroDmgPerMin: number | null; siegeDmgPerMin: number | null;
  healingPerMin: number | null; xpPerMin: number | null;
}
export interface MapRowVM {
  map: string; img: string | null;
  games: number; firstPickWinRate: number | null; firstPickKnown: number;
}
export interface TeamMapCellVM { games: number; wins: number; winRate: number | null; }
export interface TournamentData {
  configured: boolean; // 로스터가 하나라도 실제 스트리머와 매칭됐는지
  teams: TeamVM[];
  teamNames: Record<string, string>;
  maps: MapRowVM[];
  teamMaps: TeamMapCellVM[][]; // [teams 행][maps 열] 정렬
  h2h: (H2HCellVM | null)[][]; // [행 팀][열 팀], 같은 팀 = null
  games: GameVM[]; // 최신순
  positions: { role: Role; rows: PositionRowVM[] }[];
}

// 큰 수 축약 — 막대 라벨용 (12345 → "12.3k")
function abbrevNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
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
  links: TournamentGameLink[],
  streamers: Streamer[],
  config: TournamentTeamConfig[] = TOURNAMENT_TEAMS,
): TournamentData {
  const rosters = resolveTeams(streamers, config);
  const configured = rosters.some((r) => r.ids.size > 0);
  const games = linkTournamentGames(matches, links);
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

  const maps: MapRowVM[] = mapRecords(games)
    .filter((m) => m.games > 0)
    .map((m) => ({
      map: m.map, img: mapImageUrl(m.map),
      games: m.games, firstPickWinRate: m.firstPickWinRate, firstPickKnown: m.firstPickKnown,
    }));

  // 팀별 맵 승률 — 행=teams, 열=maps 순서 정렬
  const tmMap = teamMapRecords(games);
  const teamMaps: TeamMapCellVM[][] = rosters.map((r) =>
    maps.map((m) => tmMap.get(`${r.id}|${m.map}`) ?? { games: 0, wins: 0, winRate: null }));

  const h2h = rosters.map((row) => rosters.map((col) => {
    if (row.id === col.id) return null;
    const r = h2hMap.get(`${row.id}|${col.id}`);
    if (!r) return null;
    const g = r.wins + r.losses;
    return { wins: r.wins, losses: r.losses, games: g, winRate: g ? r.wins / g : 0 };
  }));

  // 진영별 대회팀 로스터 id — 여기 없는 출전자가 용병(대타)
  const idsByTeam = new Map(rosters.map((r) => [r.id, r.ids]));

  const sideVM = (g: TournamentGame, bucket: 'blue' | 'red'): SideVM => {
    const m = g.match;
    const own = idsByTeam.get(g.teams[bucket]);
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
        const isHealer = roleOfHero(hero) === '지원가';
        const barValue = st ? (isHealer ? st.healing : st.heroDmg) : undefined;
        return {
          name: s?.name ?? id, gameName: s?.gameNames?.[0], hero,
          kda: st ? `${st.kills}/${st.assists}/${st.deaths}` : undefined, // KAD 순 (킬/어시/데스)
          barKind: st ? (isHealer ? 'heal' as const : 'dmg' as const) : undefined,
          barValue,
          barLabel: barValue !== undefined ? abbrevNum(barValue) : undefined,
          ...(own && !own.has(id) ? { merc: true } : {}),
        };
      }),
    };
  };

  const gameVMs: GameVM[] = [...games].reverse().map((g) => {
    const m = g.match;
    // 선픽팀을 왼쪽에 — 미지정이면 blue 버킷 왼쪽
    const leftBucket: 'blue' | 'red' = m.firstPick === 'red' ? 'red' : 'blue';
    const rightBucket = leftBucket === 'blue' ? 'red' : 'blue';
    const left = sideVM(g, leftBucket);
    const right = sideVM(g, rightBucket);
    // 막대 정규화 기준 — 경기 내 전체 선수 중 종류별 최대값
    const all = [...left.players, ...right.players];
    const maxOf = (kind: 'dmg' | 'heal') =>
      all.reduce((mx, p) => (p.barKind === kind && p.barValue ? Math.max(mx, p.barValue) : mx), 0);
    return {
      id: m.id, no: g.no, dateLabel: dateLabel(m.date),
      map: m.map, mapImg: m.map ? mapImageUrl(m.map) : null, dur: m.dur,
      left, right, firstPickKnown: !!m.firstPick,
      maxDmg: maxOf('dmg'), maxHeal: maxOf('heal'),
    };
  });

  // 포지션 테이블 행 — 팀 소속은 로스터 기준
  const teamOfStreamer = (id: string): string => {
    for (const r of rosters) if (r.ids.has(id)) return r.name;
    return '용병'; // positionStats가 용병을 걸러내므로 실제로는 도달하지 않음
  };
  // 팀 순서(설정 순 1→4) 정렬 인덱스
  const teamIndexOf = (id: string): number => {
    const i = rosters.findIndex((r) => r.ids.has(id));
    return i < 0 ? rosters.length : i;
  };
  // 용병 출전은 positionStats에서 제외 — 개인 통계엔 자기 팀으로 뛴 경기만 남는다.
  // (팀 승패는 teamRecords가 팀 단위로 세므로 용병 출전과 무관하게 그대로 반영)
  const rows = positionStats(games, rosters);
  const positions = POSITION_ORDER
    .map((role) => ({
      role,
      rows: rows.filter((r) => r.role === role)
        // 팀 순서 우선, 같은 팀 내는 positionStats 기존 정렬(경기·승률) 유지
        .sort((a, b) => teamIndexOf(a.streamerId) - teamIndexOf(b.streamerId))
        .map((r) => {
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

  return { configured, teams, teamNames, maps, teamMaps, h2h, games: gameVMs, positions };
}
