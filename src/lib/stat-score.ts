import type { Match, Role } from './types';
import { statOf, participants } from './match';
import { roleOfHero } from './heroes';

interface StatWeights {
  kda: number;
  xpPerMin: number;
  heroDmgPerMin: number;
  siegeDmgPerMin: number;
  healingPerMin: number;
  selfHealPerMin: number;
}

// docs/tierlist-logic.md 역할별 스탯 가중치 테이블
const ROLE_STAT_WEIGHTS: Record<Role, StatWeights> = {
  '암살자': { kda: 0.25, xpPerMin: 0.20, heroDmgPerMin: 0.40, siegeDmgPerMin: 0.05, healingPerMin: 0.00, selfHealPerMin: 0.10 },
  '탱커':   { kda: 0.25, xpPerMin: 0.20, heroDmgPerMin: 0.20, siegeDmgPerMin: 0.05, healingPerMin: 0.05, selfHealPerMin: 0.25 },
  '지원가': { kda: 0.20, xpPerMin: 0.20, heroDmgPerMin: 0.10, siegeDmgPerMin: 0.05, healingPerMin: 0.40, selfHealPerMin: 0.05 },
  '투사':   { kda: 0.20, xpPerMin: 0.20, heroDmgPerMin: 0.25, siegeDmgPerMin: 0.10, healingPerMin: 0.05, selfHealPerMin: 0.20 },
  '전문가': { kda: 0.20, xpPerMin: 0.25, heroDmgPerMin: 0.20, siegeDmgPerMin: 0.20, healingPerMin: 0.10, selfHealPerMin: 0.05 },
};

type StatKey = keyof StatWeights;
const STAT_KEYS: StatKey[] = ['kda', 'xpPerMin', 'heroDmgPerMin', 'siegeDmgPerMin', 'healingPerMin', 'selfHealPerMin'];

interface MatchStatEntry {
  streamerId: string;
  role: Role;
  kda: number;
  xpPerMin: number;
  heroDmgPerMin: number;
  siegeDmgPerMin: number;
  healingPerMin: number;
  selfHealPerMin: number;
}

// "M:SS" / "MM:SS" → 분 (소수). 파싱 실패 시 null.
function durToMins(dur: string | undefined): number | null {
  if (!dur) return null;
  const m = dur.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  const mins = Number(m[1]) + Number(m[2]) / 60;
  return mins > 0 ? mins : null;
}

// 모든 경기에서 스탯 기록된 항목 수집. 영웅 역할 기반으로 분류.
function collectEntries(matches: Match[]): MatchStatEntry[] {
  const entries: MatchStatEntry[] = [];
  for (const m of matches) {
    const scale = durToMins(m.dur) ?? 1; // dur 없으면 raw 값 그대로 (단위 일관성 유지)
    for (const [streamerId, hero] of participants(m)) {
      const role = roleOfHero(hero);
      if (!role) continue;
      const stat = statOf(m, streamerId);
      if (!stat) continue;
      entries.push({
        streamerId, role,
        kda:            (stat.kills + stat.assists) / Math.max(1, stat.deaths),
        xpPerMin:       stat.xp       / scale,
        heroDmgPerMin:  stat.heroDmg  / scale,
        siegeDmgPerMin: stat.siegeDmg / scale,
        healingPerMin:  stat.healing  / scale,
        selfHealPerMin: stat.selfHeal / scale,
      });
    }
  }
  return entries;
}

// 역할별 각 stat 차원의 min/max (정규화 기준 범위)
function calcRanges(
  entries: MatchStatEntry[],
): Map<Role, Record<StatKey, { min: number; max: number }>> {
  const map = new Map<Role, Record<StatKey, { min: number; max: number }>>();
  for (const e of entries) {
    if (!map.has(e.role)) {
      map.set(e.role, Object.fromEntries(
        STAT_KEYS.map(k => [k, { min: Infinity, max: -Infinity }]),
      ) as Record<StatKey, { min: number; max: number }>);
    }
    const r = map.get(e.role)!;
    for (const k of STAT_KEYS) {
      if (e[k] < r[k].min) r[k].min = e[k];
      if (e[k] > r[k].max) r[k].max = e[k];
    }
  }
  return map;
}

// 단일 항목을 역할 범위 기준으로 정규화 후 가중합 → 0~1
function scoreEntry(
  e: MatchStatEntry,
  ranges: Record<StatKey, { min: number; max: number }>,
): number {
  const w = ROLE_STAT_WEIGHTS[e.role];
  let score = 0;
  for (const k of STAT_KEYS) {
    const { min, max } = ranges[k];
    const norm = max > min ? (e[k] - min) / (max - min) : 0.5;
    score += w[k] * norm;
  }
  return score;
}

// 전체 스트리머의 스탯 점수(0~1) + 커버리지(스탯 기록 경기 비율) 계산
export function calcAllStatScores(
  matches: Match[],
  streamerIds: string[],
): Map<string, { score: number; coverage: number }> {
  // 스트리머별 총 참가 경기 수
  const totalGames = new Map<string, number>(streamerIds.map(id => [id, 0]));
  for (const m of matches) {
    for (const [id] of participants(m)) {
      if (totalGames.has(id)) totalGames.set(id, (totalGames.get(id) ?? 0) + 1);
    }
  }

  const entries = collectEntries(matches);
  const ranges = calcRanges(entries);
  const accum = new Map<string, { sum: number; count: number }>(
    streamerIds.map(id => [id, { sum: 0, count: 0 }]),
  );

  for (const e of entries) {
    if (!accum.has(e.streamerId)) continue;
    const roleRanges = ranges.get(e.role);
    if (!roleRanges) continue;
    const a = accum.get(e.streamerId)!;
    a.sum += scoreEntry(e, roleRanges);
    a.count++;
  }

  const result = new Map<string, { score: number; coverage: number }>();
  for (const id of streamerIds) {
    const total = totalGames.get(id) ?? 0;
    const a = accum.get(id) ?? { sum: 0, count: 0 };
    result.set(id, {
      score:    a.count > 0 ? a.sum / a.count : 0.5,
      coverage: total  > 0 ? a.count / total  : 0,
    });
  }
  return result;
}

// coverage → α (winRate 가중치). 스탯 신뢰도 낮을수록 승률 비중 높임.
export function statAlpha(coverage: number): number {
  if (coverage < 0.3) return 0.80;
  if (coverage < 0.7) return 0.50;
  return 0.35;
}

// stat score(0~1) → 가상 승률(0.3~0.7). 스탯이 티어를 과도하게 뒤집지 않도록 제한.
export function statToWinRate(statScore: number): number {
  return 0.3 + statScore * 0.4;
}
