// 프로 스크림 밴픽 기록 도메인.
// 팀 구분 규약: blue = 선픽팀(카드 윗행), red = 후픽팀(아랫행) 고정.
// 진영(좌/우)은 기록하지 않는다 — 밴픽 순서가 기록 대상이므로 선픽 여부만 의미 있음.
import { buildSequence } from './draft/sequence';
import type { Team } from './draft/types';

export interface Scrim {
  id: string;
  date: Date;
  patch?: string;                 // 패치 버전 (예: 2.55.8)
  map: string;
  winner: Team;                   // blue=선픽팀, red=후픽팀
  bans: Record<Team, string[]>;   // 팀당 3, 드래프트 진행 순서대로
  picks: Record<Team, string[]>;  // 팀당 5, 드래프트 진행 순서대로
  // 하드 피어리스 세트 묶음 식별자 — 같은 세트의 경기들이 공유.
  // 없으면(과거 기록 등) 자기 자신만 속한 1경기짜리 세트로 취급(assignScrimNumbers).
  seriesId?: string;
  createdAt: Date;
}

// 전역 16스텝 타임라인 항목. hero 없음 = 아직 입력 안 된 슬롯(입력 미리보기용).
export interface ScrimStep {
  kind: 'ban' | 'pick';
  team: Team;
  hero?: string;
}

// 페이즈(밴1|픽1|밴2|픽2)가 새로 시작되는 전역 인덱스 — 카드에서 시각적 간격용.
export const PHASE_STARTS = new Set([4, 9, 11]);

// 팀별 밴/픽 큐를 선픽=blue 고정 시퀀스에 순서대로 소비시켜 전역 타임라인 복원.
export function scrimTimeline(
  bans: Record<Team, string[]>,
  picks: Record<Team, string[]>,
): ScrimStep[] {
  const cursor = { ban: { blue: 0, red: 0 }, pick: { blue: 0, red: 0 } };
  return buildSequence('blue').map(({ kind, team }) => {
    const src = kind === 'ban' ? bans : picks;
    const hero = src[team][cursor[kind][team]++];
    return { kind, team, ...(hero !== undefined ? { hero } : {}) };
  });
}

export interface ScrimNumber {
  gameNo: number;        // 전체 경기 중 순번 — 오래된 경기부터 1 (세트 무관)
  dateSetNo: number;     // 세트의 날짜 안에서 몇 번째 세트인지 — 오래된 세트부터 1
  gameInSetNo: number;   // 세트 내 경기 순번 — 오래된 경기부터 1
  gamesInSeries: number; // 이 세트에 속한 총 경기 수 (1이면 단독 기록)
}

const scrimOrder = (a: Scrim, b: Scrim) =>
  a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime();

// 경기 date는 시각 없는 자정값이라 로컬 날짜 그대로 키로 쓸 수 있다.
const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// 세트(하드 피어리스 시리즈) 단위로 번호를 매긴다.
// seriesId가 같은 경기들을 한 세트로 묶고, 없는 경기(과거 기록 등)는 자기 자신만 속한
// 1경기짜리 세트로 취급 — 항상 모든 경기에 번호가 붙는다.
// gameNo는 세트와 무관하게 전체 경기 중 오래된 순 전역 번호.
// dateSetNo는 세트의 대표 날짜(세트 내 가장 오래된 경기의 날짜) 안에서만 오래된 순으로 매긴다.
export function assignScrimNumbers(scrims: Scrim[]): Map<string, ScrimNumber> {
  // 전역 경기 번호
  const byGame = [...scrims].sort(scrimOrder);
  const gameNoById = new Map(byGame.map((s, i) => [s.id, i + 1]));

  // 세트 그룹핑
  const groups = new Map<string, Scrim[]>();
  for (const s of scrims) {
    const key = s.seriesId ?? `__solo:${s.id}`;
    const g = groups.get(key);
    if (g) g.push(s); else groups.set(key, [s]);
  }
  const series = [...groups.values()].map((games) => [...games].sort(scrimOrder));

  // 날짜별로 세트를 묶어 그 안에서만 순번 매김 (세트 대표 날짜 = 세트 내 최초 경기 날짜)
  const byDate = new Map<string, typeof series>();
  for (const games of series) {
    const key = dateKey(games[0].date);
    const g = byDate.get(key);
    if (g) g.push(games); else byDate.set(key, [games]);
  }
  for (const group of byDate.values()) group.sort((a, b) => scrimOrder(a[0], b[0]));

  const result = new Map<string, ScrimNumber>();
  for (const group of byDate.values()) {
    group.forEach((games, si) => {
      games.forEach((s, gi) => {
        result.set(s.id, {
          gameNo: gameNoById.get(s.id)!,
          dateSetNo: si + 1,
          gameInSetNo: gi + 1,
          gamesInSeries: games.length,
        });
      });
    });
  }
  return result;
}

// API 경계 검증 — 문제 있으면 오류 메시지, 정상이면 null.
export function validateScrimPayload(d: {
  date?: unknown; map?: unknown; patch?: unknown; winner?: unknown; seriesId?: unknown;
  bans?: Partial<Record<Team, unknown>>; picks?: Partial<Record<Team, unknown>>;
}): string | null {
  const strArr = (v: unknown, n: number) =>
    Array.isArray(v) && v.length === n && v.every((h) => typeof h === 'string' && h.trim() !== '');
  if (typeof d.map !== 'string' || !d.map.trim()) return '맵이 없습니다';
  if (d.winner !== 'blue' && d.winner !== 'red') return '승리 팀이 올바르지 않습니다';
  if (typeof d.date !== 'string' || isNaN(new Date(d.date).getTime())) return '날짜가 올바르지 않습니다';
  if (d.patch !== undefined && typeof d.patch !== 'string') return '패치 버전이 올바르지 않습니다';
  if (d.seriesId !== undefined && typeof d.seriesId !== 'string') return '세트 식별자가 올바르지 않습니다';
  for (const t of ['blue', 'red'] as const) {
    if (!strArr(d.bans?.[t], 3)) return '밴 목록이 올바르지 않습니다 (팀당 3)';
    if (!strArr(d.picks?.[t], 5)) return '픽 목록이 올바르지 않습니다 (팀당 5)';
  }
  return null;
}
