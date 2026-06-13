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

// "M:SS" / "MM:SS" → 분 (소수). 파싱 실패 시 null.
function durToMins(dur: string | undefined): number | null {
  if (!dur) return null;
  const m = dur.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  const mins = Number(m[1]) + Number(m[2]) / 60;
  return mins > 0 ? mins : null;
}

interface RoleAccum {
  sums: Record<StatKey, number>;
  count: number;
}

// 플레이어별 역할별 raw 스탯 누적
function collectPlayerAccum(
  matches: Match[],
): Map<string, Map<Role, RoleAccum>> {
  const playerMap = new Map<string, Map<Role, RoleAccum>>();

  for (const m of matches) {
    const scale = durToMins(m.dur) ?? 1;
    for (const [streamerId, hero] of participants(m)) {
      const role = roleOfHero(hero);
      if (!role) continue;
      const stat = statOf(m, streamerId);
      if (!stat) continue;

      if (!playerMap.has(streamerId)) playerMap.set(streamerId, new Map());
      const roleMap = playerMap.get(streamerId)!;
      if (!roleMap.has(role)) {
        roleMap.set(role, {
          sums: Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Record<StatKey, number>,
          count: 0,
        });
      }
      const a = roleMap.get(role)!;
      a.sums.kda            += (stat.kills + stat.assists) / Math.max(1, stat.deaths);
      a.sums.xpPerMin       += stat.xp       / scale;
      a.sums.heroDmgPerMin  += stat.heroDmg  / scale;
      a.sums.siegeDmgPerMin += stat.siegeDmg / scale;
      a.sums.healingPerMin  += stat.healing  / scale;
      a.sums.selfHealPerMin += stat.selfHeal / scale;
      a.count++;
    }
  }
  return playerMap;
}

type PlayerAvgMap = Map<string, Map<Role, { avgs: Record<StatKey, number>; count: number }>>;

// 플레이어별 역할별 경기 평균 계산 (개별 경기 집계 → 평균)
function buildPlayerAvgMap(
  playerAccum: Map<string, Map<Role, RoleAccum>>,
): PlayerAvgMap {
  const out: PlayerAvgMap = new Map();
  for (const [streamerId, roleMap] of playerAccum) {
    const entry = new Map<Role, { avgs: Record<StatKey, number>; count: number }>();
    for (const [role, { sums, count }] of roleMap) {
      entry.set(role, {
        avgs: Object.fromEntries(STAT_KEYS.map(k => [k, sums[k] / count])) as Record<StatKey, number>,
        count,
      });
    }
    out.set(streamerId, entry);
  }
  return out;
}

// 역할별 각 스탯 차원의 min/max — 플레이어 평균값 기준으로 계산
// (개별 경기 극단값이 아닌 플레이어 간 실제 차이를 반영)
function calcRanges(
  playerAvgMap: PlayerAvgMap,
): Map<Role, Record<StatKey, { min: number; max: number }>> {
  const ranges = new Map<Role, Record<StatKey, { min: number; max: number }>>();
  for (const roleMap of playerAvgMap.values()) {
    for (const [role, { avgs }] of roleMap) {
      if (!ranges.has(role)) {
        ranges.set(role, Object.fromEntries(
          STAT_KEYS.map(k => [k, { min: Infinity, max: -Infinity }]),
        ) as Record<StatKey, { min: number; max: number }>);
      }
      const r = ranges.get(role)!;
      for (const k of STAT_KEYS) {
        if (avgs[k] < r[k].min) r[k].min = avgs[k];
        if (avgs[k] > r[k].max) r[k].max = avgs[k];
      }
    }
  }
  return ranges;
}

// 정규화된 가중합 점수 (0~1)
function scoreAvg(
  avgs: Record<StatKey, number>,
  role: Role,
  ranges: Record<StatKey, { min: number; max: number }>,
): number {
  const w = ROLE_STAT_WEIGHTS[role];
  let score = 0;
  for (const k of STAT_KEYS) {
    const { min, max } = ranges[k];
    const norm = max > min ? (avgs[k] - min) / (max - min) : 0.5;
    score += w[k] * norm;
  }
  return score;
}

// 전체 스트리머의 스탯 점수(0~1) + 커버리지(스탯 기록 경기 비율) 계산
export function calcAllStatScores(
  matches: Match[],
  streamerIds: string[],
): Map<string, { score: number; coverage: number }> {
  const totalGames = new Map<string, number>(streamerIds.map(id => [id, 0]));
  for (const m of matches) {
    for (const [id] of participants(m)) {
      if (totalGames.has(id)) totalGames.set(id, (totalGames.get(id) ?? 0) + 1);
    }
  }

  const playerAccum  = collectPlayerAccum(matches);
  const playerAvgMap = buildPlayerAvgMap(playerAccum);
  const ranges       = calcRanges(playerAvgMap);

  const result = new Map<string, { score: number; coverage: number }>();

  for (const id of streamerIds) {
    const roleMap = playerAvgMap.get(id);
    if (!roleMap || roleMap.size === 0) {
      result.set(id, { score: 0.5, coverage: 0 });
      continue;
    }

    // 여러 역할을 플레이한 경우 게임 수 가중 평균
    let totalStatGames = 0;
    let weightedScore  = 0;
    for (const [role, { avgs, count }] of roleMap) {
      const roleRanges = ranges.get(role);
      if (!roleRanges) continue;
      weightedScore  += scoreAvg(avgs, role, roleRanges) * count;
      totalStatGames += count;
    }

    const score    = totalStatGames > 0 ? weightedScore / totalStatGames : 0.5;
    const total    = totalGames.get(id) ?? 0;
    const coverage = total > 0 ? totalStatGames / total : 0;
    result.set(id, { score, coverage });
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
  return 0.2 + statScore * 0.6;
}
