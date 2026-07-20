// 스크림 밴픽 기록 집계 — 대시보드 탭 전용 순수 함수.
// 팀 익명(선픽/후픽만 구분) 전제: "픽 승률" = 그 영웅을 픽한 팀이 이긴 비율.
import { scrimTimeline, seriesLockedHeroes, type Scrim } from './scrim';
import { roleOfHero } from './heroes';
import type { Role } from './types';

// 조합(시너지·카운터) 최소 표본 — relations.ts MIN_RELATION과 같은 철학
export const MIN_PAIR_GAMES = 3;

// 전역 타임라인 기준 밴 페이즈 경계: 0~3 = 오프닝 밴, 9~10 = 미드밴
const OPEN_BAN_LAST = 3;

// 경기별 잠금 영웅 맵. 통계 함수들이 공통으로 받는다 —
// 맵·패치로 걸러진 부분집합에서 다시 계산하면 이전 경기가 빠져 잠금이 어긋나므로,
// 항상 필터 이전의 전체 목록으로 만든 맵을 넘겨야 한다.
export type LockMap = Map<string, Set<string>>;

// ── 영웅별 메타 테이블 ────────────────────────────────────────

export interface HeroScrimStat {
  hero: string;
  bans: number;
  openBans: number;      // 1페이즈(즉시) 밴
  midBans: number;       // 미드(대응) 밴
  picks: number;
  pickWins: number;
  availableGames: number; // 하드 피어리스 잠금이 아니었던 경기 수 — 모든 비율의 분모
  banRate: number;       // 밴 경기 / 가용 경기
  pickRate: number;      // 픽 경기 / 가용 경기
  presenceRate: number;  // (밴+픽) 경기 / 가용 경기 — 관여율
  pickWinRate: number;   // 픽 시 승률 (픽 0이면 0)
  avgPickOrder: number | null; // 전역 픽 순번(1~10) 평균 — 낮을수록 선픽 소모
  openPickRate: number;  // 가용 경기 중 밴도 안 된 경기에서 픽된 비율 — "열리면 가져가는" 지표
}

export function heroScrimStats(
  scrims: Scrim[],
  locked: LockMap = seriesLockedHeroes(scrims),
): HeroScrimStat[] {
  interface Acc { bans: number; openBans: number; midBans: number; picks: number; pickWins: number; pickOrderSum: number; }
  const acc = new Map<string, Acc>();
  const get = (h: string): Acc => {
    let a = acc.get(h);
    if (!a) { a = { bans: 0, openBans: 0, midBans: 0, picks: 0, pickWins: 0, pickOrderSum: 0 }; acc.set(h, a); }
    return a;
  };
  // 영웅별 잠긴 경기 수 — 가용 경기 = 전체 - 잠김
  const lockedGames = new Map<string, number>();

  for (const s of scrims) {
    for (const h of locked.get(s.id) ?? []) {
      lockedGames.set(h, (lockedGames.get(h) ?? 0) + 1);
    }
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
    .map(([hero, a]) => {
      const avail = n - (lockedGames.get(hero) ?? 0);
      return {
        hero,
        bans: a.bans, openBans: a.openBans, midBans: a.midBans,
        picks: a.picks, pickWins: a.pickWins,
        availableGames: avail,
        banRate: avail > 0 ? a.bans / avail : 0,
        pickRate: avail > 0 ? a.picks / avail : 0,
        presenceRate: avail > 0 ? (a.bans + a.picks) / avail : 0,
        pickWinRate: a.picks ? a.pickWins / a.picks : 0,
        avgPickOrder: a.picks ? a.pickOrderSum / a.picks : null,
        // 같은 경기에서 밴+픽 동시 발생 불가(엔진이 소비된 영웅 제외) → 열린 경기 = 가용 - 밴
        openPickRate: avail - a.bans > 0 ? a.picks / (avail - a.bans) : 0,
      };
    })
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

// ── 1픽(퍼스트픽) 영웅 ───────────────────────────────────────

export interface FirstPickHeroStat { hero: string; picks: number; wins: number; winRate: number; }

// 전역 1픽 = 선픽팀(blue)의 팀 로컬 첫 픽. 밴 4장을 넘긴 영웅의 가치 신호.
export function firstPickHeroStats(scrims: Scrim[]): FirstPickHeroStat[] {
  const acc = new Map<string, { picks: number; wins: number }>();
  for (const s of scrims) {
    const hero = s.picks.blue[0];
    if (!hero) continue;
    const a = acc.get(hero) ?? { picks: 0, wins: 0 };
    a.picks++;
    if (s.winner === 'blue') a.wins++;
    acc.set(hero, a);
  }
  return [...acc.entries()]
    .map(([hero, a]) => ({ hero, ...a, winRate: a.wins / a.picks }))
    .sort((x, y) => y.picks - x.picks || y.winRate - x.winRate || x.hero.localeCompare(y.hero, 'ko'));
}

// ── 오프닝 밴(전역 1~4) 영웅 ─────────────────────────────────

export interface OpenBanHeroStat {
  hero: string;
  bans: number;        // 오프닝 밴 횟수
  byFirstPick: number; // 그중 선픽팀이 자른 횟수
  avgBanOrder: number; // 전역 밴 순번(1~4) 평균 — 낮을수록 최우선 컷
}

// 오프닝 밴 전역 순서: 1=선픽팀 1밴, 2=후픽팀 1밴, 3=선픽팀 2밴, 4=후픽팀 2밴
export function openBanHeroStats(scrims: Scrim[]): OpenBanHeroStat[] {
  const acc = new Map<string, { bans: number; byFirstPick: number; orderSum: number }>();
  for (const s of scrims) {
    const seq = [
      { hero: s.bans.blue[0], first: true },
      { hero: s.bans.red[0], first: false },
      { hero: s.bans.blue[1], first: true },
      { hero: s.bans.red[1], first: false },
    ];
    seq.forEach(({ hero, first }, i) => {
      if (!hero) return;
      const a = acc.get(hero) ?? { bans: 0, byFirstPick: 0, orderSum: 0 };
      a.bans++;
      if (first) a.byFirstPick++;
      a.orderSum += i + 1;
      acc.set(hero, a);
    });
  }
  return [...acc.entries()]
    .map(([hero, a]) => ({ hero, bans: a.bans, byFirstPick: a.byFirstPick, avgBanOrder: a.orderSum / a.bans }))
    .sort((x, y) => y.bans - x.bans || x.avgBanOrder - y.avgBanOrder || x.hero.localeCompare(y.hero, 'ko'));
}

// ── 시리즈(세트) 단위 지표 ───────────────────────────────────
// 경기 단위 통계로는 안 보이는 하드 피어리스 고유 신호를 잡는다.
// 다중 경기 세트만 대상 — 단독 기록은 "세트 내 순번" 개념이 없어 지표를 왜곡한다.

export const MIN_SERIES_GAMES = 2;

export interface SeriesHeroStat {
  hero: string;
  seriesCount: number;     // 등장(밴 or 픽)한 세트 수
  totalSeries: number;     // 집계 대상 전체 세트 수
  seriesRate: number;      // 세트 관여율 — 경기 관여율보다 우선순위를 잘 반영
  avgConsumeGame: number;  // 세트 내 최초 소모(밴|픽) 경기 순번 평균 — 낮을수록 최우선 자원
  repeatBanSeries: number; // 한 세트에서 2회 이상 밴된 세트 수 — "절대 안 준다" 신호
  maxBansInSeries: number;
  earlyPicks: number;      // 세트 1경기째 픽 수
  latePicks: number;       // 2경기 이후 픽 수
  isDepth: boolean;        // 1경기째엔 한 번도 안 뽑히고 2경기 이후에만 등장 — 뎁스 픽
  role: Role | null;
}

export function seriesHeroStats(
  scrims: Scrim[],
  minGamesInSeries = MIN_SERIES_GAMES,
): SeriesHeroStat[] {
  // 세트 그룹핑 — seriesId 없는 기록은 단독이라 어차피 minGamesInSeries에서 걸러진다.
  const groups = new Map<string, Scrim[]>();
  for (const s of scrims) {
    const key = s.seriesId ?? `__solo:${s.id}`;
    const g = groups.get(key);
    if (g) g.push(s); else groups.set(key, [s]);
  }
  const series = [...groups.values()]
    .filter((g) => g.length >= minGamesInSeries)
    .map((g) => [...g].sort((a, b) =>
      a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime()));

  interface Acc {
    seriesCount: number; consumeGameSum: number; repeatBanSeries: number;
    maxBansInSeries: number; earlyPicks: number; latePicks: number;
  }
  const acc = new Map<string, Acc>();
  const get = (h: string): Acc => {
    let a = acc.get(h);
    if (!a) {
      a = { seriesCount: 0, consumeGameSum: 0, repeatBanSeries: 0, maxBansInSeries: 0, earlyPicks: 0, latePicks: 0 };
      acc.set(h, a);
    }
    return a;
  };

  for (const games of series) {
    // 이 세트 안에서 영웅별 집계
    const inSeries = new Map<string, { firstGame: number; bans: number; early: number; late: number }>();
    games.forEach((s, i) => {
      const gameNo = i + 1;
      const touch = (h: string) => {
        let r = inSeries.get(h);
        if (!r) { r = { firstGame: gameNo, bans: 0, early: 0, late: 0 }; inSeries.set(h, r); }
        return r;
      };
      for (const h of [...s.bans.blue, ...s.bans.red]) touch(h).bans++;
      for (const h of [...s.picks.blue, ...s.picks.red]) {
        const r = touch(h);
        if (gameNo === 1) r.early++; else r.late++;
      }
    });

    for (const [hero, r] of inSeries) {
      const a = get(hero);
      a.seriesCount++;
      a.consumeGameSum += r.firstGame;
      if (r.bans >= 2) a.repeatBanSeries++;
      a.maxBansInSeries = Math.max(a.maxBansInSeries, r.bans);
      a.earlyPicks += r.early;
      a.latePicks += r.late;
    }
  }

  const total = series.length;
  return [...acc.entries()]
    .map(([hero, a]) => ({
      hero,
      seriesCount: a.seriesCount,
      totalSeries: total,
      seriesRate: total ? a.seriesCount / total : 0,
      avgConsumeGame: a.consumeGameSum / a.seriesCount,
      repeatBanSeries: a.repeatBanSeries,
      maxBansInSeries: a.maxBansInSeries,
      earlyPicks: a.earlyPicks,
      latePicks: a.latePicks,
      isDepth: a.earlyPicks === 0 && a.latePicks > 0,
      role: roleOfHero(hero),
    }))
    .sort((x, y) =>
      y.seriesRate - x.seriesRate || x.avgConsumeGame - y.avgConsumeGame || x.hero.localeCompare(y.hero, 'ko'));
}

// ── 패치 필터 ────────────────────────────────────────────────

// 기록에 존재하는 패치 목록 — 최신(내림차순) 우선, 미기입은 제외.
export function distinctPatches(scrims: Scrim[]): string[] {
  return [...new Set(scrims.map((s) => s.patch).filter((p): p is string => !!p))]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}
