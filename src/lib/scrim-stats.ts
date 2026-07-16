// 스크림 밴픽 기록 집계 — 대시보드 탭 전용 순수 함수.
// 팀 익명(선픽/후픽만 구분) 전제: "픽 승률" = 그 영웅을 픽한 팀이 이긴 비율.
import { scrimTimeline, type Scrim } from './scrim';
import { roleOfHero } from './heroes';
import type { Role } from './types';

// 조합(시너지·카운터) 최소 표본 — relations.ts MIN_RELATION과 같은 철학
export const MIN_PAIR_GAMES = 3;

// 전역 타임라인 기준 밴 페이즈 경계: 0~3 = 오프닝 밴, 9~10 = 미드밴
const OPEN_BAN_LAST = 3;

// ── 영웅별 메타 테이블 ────────────────────────────────────────

export interface HeroScrimStat {
  hero: string;
  bans: number;
  openBans: number;      // 1페이즈(즉시) 밴
  midBans: number;       // 미드(대응) 밴
  picks: number;
  pickWins: number;
  banRate: number;       // 밴 경기 / 전체 경기
  pickRate: number;      // 픽 경기 / 전체 경기
  presenceRate: number;  // (밴+픽) 경기 / 전체 경기 — 관여율
  pickWinRate: number;   // 픽 시 승률 (픽 0이면 0)
  avgPickOrder: number | null; // 전역 픽 순번(1~10) 평균 — 낮을수록 선픽 소모
  openPickRate: number;  // 밴 안 된 경기 중 픽된 비율 — "열리면 가져가는" 지표
}

export function heroScrimStats(scrims: Scrim[]): HeroScrimStat[] {
  interface Acc { bans: number; openBans: number; midBans: number; picks: number; pickWins: number; pickOrderSum: number; }
  const acc = new Map<string, Acc>();
  const get = (h: string): Acc => {
    let a = acc.get(h);
    if (!a) { a = { bans: 0, openBans: 0, midBans: 0, picks: 0, pickWins: 0, pickOrderSum: 0 }; acc.set(h, a); }
    return a;
  };

  for (const s of scrims) {
    let pickNo = 0;
    scrimTimeline(s.bans, s.picks).forEach((st, i) => {
      if (st.kind === 'pick') pickNo++;
      if (!st.hero) return;
      const a = get(st.hero);
      if (st.kind === 'ban') {
        a.bans++;
        if (i <= OPEN_BAN_LAST) a.openBans++; else a.midBans++;
      } else {
        a.picks++;
        a.pickOrderSum += pickNo;
        if (s.winner === st.team) a.pickWins++;
      }
    });
  }

  const n = scrims.length;
  return [...acc.entries()]
    .map(([hero, a]) => ({
      hero,
      bans: a.bans, openBans: a.openBans, midBans: a.midBans,
      picks: a.picks, pickWins: a.pickWins,
      banRate: n ? a.bans / n : 0,
      pickRate: n ? a.picks / n : 0,
      presenceRate: n ? (a.bans + a.picks) / n : 0,
      pickWinRate: a.picks ? a.pickWins / a.picks : 0,
      avgPickOrder: a.picks ? a.pickOrderSum / a.picks : null,
      // 같은 경기에서 밴+픽 동시 발생 불가(엔진이 소비된 영웅 제외) → 열린 경기 = n - 밴
      openPickRate: n - a.bans > 0 ? a.picks / (n - a.bans) : 0,
    }))
    .sort((a, b) => b.presenceRate - a.presenceRate || b.picks - a.picks || a.hero.localeCompare(b.hero, 'ko'));
}

// ── 맵별 · 선픽 통계 ─────────────────────────────────────────

export interface MapScrimStat {
  map: string;
  games: number;
  firstPickWins: number;
  firstPickWinRate: number;
}

export function mapScrimStats(scrims: Scrim[]): MapScrimStat[] {
  const acc = new Map<string, { games: number; fpWins: number }>();
  for (const s of scrims) {
    const a = acc.get(s.map) ?? { games: 0, fpWins: 0 };
    a.games++;
    if (s.winner === 'blue') a.fpWins++; // blue = 선픽팀 규약
    acc.set(s.map, a);
  }
  return [...acc.entries()]
    .map(([map, a]) => ({ map, games: a.games, firstPickWins: a.fpWins, firstPickWinRate: a.fpWins / a.games }))
    .sort((a, b) => b.games - a.games || a.map.localeCompare(b.map, 'ko'));
}

export function firstPickSummary(scrims: Scrim[]): { games: number; firstPickWins: number; firstPickWinRate: number } {
  const wins = scrims.filter((s) => s.winner === 'blue').length;
  return { games: scrims.length, firstPickWins: wins, firstPickWinRate: scrims.length ? wins / scrims.length : 0 };
}

// ── 영웅 조합: 시너지(같은 팀) · 카운터(상대 팀) ──────────────

export interface PairStat {
  a: string;   // 카운터에서는 이기는 쪽
  b: string;
  games: number;
  wins: number;   // a가 속한 팀의 승수
  winRate: number;
}

// 같은 팀 픽 2영웅 조합 승률.
export function synergyPairs(scrims: Scrim[], minGames = MIN_PAIR_GAMES): PairStat[] {
  const acc = new Map<string, { a: string; b: string; games: number; wins: number }>();
  for (const s of scrims) {
    for (const team of ['blue', 'red'] as const) {
      const heroes = s.picks[team];
      const won = s.winner === team;
      for (let i = 0; i < heroes.length; i++) {
        for (let j = i + 1; j < heroes.length; j++) {
          const [a, b] = [heroes[i], heroes[j]].sort((x, y) => x.localeCompare(y, 'ko'));
          const key = `${a}|${b}`;
          const r = acc.get(key) ?? { a, b, games: 0, wins: 0 };
          r.games++;
          if (won) r.wins++;
          acc.set(key, r);
        }
      }
    }
  }
  return [...acc.values()]
    .filter((r) => r.games >= minGames)
    .map((r) => ({ ...r, winRate: r.wins / r.games }))
    .sort((x, y) => y.winRate - x.winRate || y.games - x.games);
}

// 상대 팀에 마주 선 2영웅 — 승률 높은 쪽을 a로 정렬해 "a가 b를 카운터" 형태로 반환.
export function counterPairs(scrims: Scrim[], minGames = MIN_PAIR_GAMES): PairStat[] {
  const acc = new Map<string, { first: string; second: string; games: number; firstWins: number }>();
  for (const s of scrims) {
    for (const ha of s.picks.blue) {
      for (const hb of s.picks.red) {
        const [first, second] = [ha, hb].sort((x, y) => x.localeCompare(y, 'ko'));
        const key = `${first}|${second}`;
        const r = acc.get(key) ?? { first, second, games: 0, firstWins: 0 };
        r.games++;
        const firstTeam = first === ha ? 'blue' : 'red';
        if (s.winner === firstTeam) r.firstWins++;
        acc.set(key, r);
      }
    }
  }
  return [...acc.values()]
    .filter((r) => r.games >= minGames)
    .map((r) => {
      const rate = r.firstWins / r.games;
      return rate >= 0.5
        ? { a: r.first, b: r.second, games: r.games, wins: r.firstWins, winRate: rate }
        : { a: r.second, b: r.first, games: r.games, wins: r.games - r.firstWins, winRate: 1 - rate };
    })
    .sort((x, y) => y.winRate - x.winRate || y.games - x.games);
}

// ── 역할군 조합 분포 ─────────────────────────────────────────

export interface RoleCompStat {
  comp: string;   // 예: '탱커1·투사1·암살자2·지원가1'
  games: number;  // 팀 단위 표본 (경기당 2)
  wins: number;
  winRate: number;
}

const ROLE_ORDER: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

function compSignature(heroes: string[]): string {
  const count = new Map<Role, number>();
  for (const h of heroes) {
    const r = roleOfHero(h);
    if (r) count.set(r, (count.get(r) ?? 0) + 1);
  }
  return ROLE_ORDER.filter((r) => count.has(r)).map((r) => `${r}${count.get(r)}`).join('·') || '(미상)';
}

export function roleCompStats(scrims: Scrim[]): RoleCompStat[] {
  const acc = new Map<string, { games: number; wins: number }>();
  for (const s of scrims) {
    for (const team of ['blue', 'red'] as const) {
      const sig = compSignature(s.picks[team]);
      const a = acc.get(sig) ?? { games: 0, wins: 0 };
      a.games++;
      if (s.winner === team) a.wins++;
      acc.set(sig, a);
    }
  }
  return [...acc.entries()]
    .map(([comp, a]) => ({ comp, games: a.games, wins: a.wins, winRate: a.wins / a.games }))
    .sort((x, y) => y.games - x.games || y.winRate - x.winRate);
}

// ── 패치 필터 ────────────────────────────────────────────────

// 기록에 존재하는 패치 목록 — 최신(내림차순) 우선, 미기입은 제외.
export function distinctPatches(scrims: Scrim[]): string[] {
  return [...new Set(scrims.map((s) => s.patch).filter((p): p is string => !!p))]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}
