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

// API 경계 검증 — 문제 있으면 오류 메시지, 정상이면 null.
export function validateScrimPayload(d: {
  date?: unknown; map?: unknown; patch?: unknown; winner?: unknown;
  bans?: Partial<Record<Team, unknown>>; picks?: Partial<Record<Team, unknown>>;
}): string | null {
  const strArr = (v: unknown, n: number) =>
    Array.isArray(v) && v.length === n && v.every((h) => typeof h === 'string' && h.trim() !== '');
  if (typeof d.map !== 'string' || !d.map.trim()) return '맵이 없습니다';
  if (d.winner !== 'blue' && d.winner !== 'red') return '승리 팀이 올바르지 않습니다';
  if (typeof d.date !== 'string' || isNaN(new Date(d.date).getTime())) return '날짜가 올바르지 않습니다';
  if (d.patch !== undefined && typeof d.patch !== 'string') return '패치 버전이 올바르지 않습니다';
  for (const t of ['blue', 'red'] as const) {
    if (!strArr(d.bans?.[t], 3)) return '밴 목록이 올바르지 않습니다 (팀당 3)';
    if (!strArr(d.picks?.[t], 5)) return '픽 목록이 올바르지 않습니다 (팀당 5)';
  }
  return null;
}
