import type { Match } from './types';

// 중복 탐지 결과 타입
export type DuplicateLevel =
  | 'none'     // 중복 없음
  | 'strong'   // 날짜 + 멤버셋 + dur 완전 일치 (확실한 중복)
  | 'weak';    // 날짜 + 멤버셋 일치 but dur 정보 없음 (확인 필요)

export interface DuplicateResult {
  level: DuplicateLevel;
  match?: Match; // 중복 후보 기존 경기 (none이면 undefined)
}

// [string, string][] 슬롯 구조에서 streamerId 집합 추출
function memberSet(team: [string, string][]): Set<string> {
  return new Set(team.map(([id]) => id));
}

// 두 멤버셋이 동일한지 비교 (순서·진영 무관)
function isSameMemberSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

// 날짜를 YYYY-MM-DD 문자열로 정규화 (시각 무시)
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * 저장 전 중복 경기 탐지.
 *
 * - strong: 날짜 + 10인 멤버셋 + dur 모두 일치 → 확실한 중복 (POV 스왑 포함)
 * - weak  : 날짜 + 10인 멤버셋 일치 but 신규 후보의 dur이 비어 있음 → 약한 경고
 * - none  : 중복 없음 (같은 멤버·다른 dur은 정상 다중 경기로 허용)
 */
export function findDuplicateMatch(
  candidate: { date: Date; blueTeam: [string, string][]; redTeam: [string, string][]; dur?: string },
  existing: Match[],
): DuplicateResult {
  const candidateDateKey = toDateKey(candidate.date);
  // 양 팀 합집합 — 진영 스왑(blue↔red)에도 동일하게 탐지
  const candidateMembers = new Set([
    ...memberSet(candidate.blueTeam),
    ...memberSet(candidate.redTeam),
  ]);

  for (const m of existing) {
    // 날짜 불일치 → 스킵
    if (toDateKey(m.date) !== candidateDateKey) continue;

    const existingMembers = new Set([
      ...memberSet(m.blueTeam),
      ...memberSet(m.redTeam),
    ]);

    // 멤버셋 불일치 → 스킵
    if (!isSameMemberSet(candidateMembers, existingMembers)) continue;

    // 날짜 + 멤버셋 일치 구간
    const candidateDur = candidate.dur?.trim() ?? '';
    const existingDur  = m.dur?.trim() ?? '';

    if (candidateDur && existingDur) {
      // 둘 다 dur 있음 → dur까지 일치하면 strong 중복
      if (candidateDur === existingDur) {
        return { level: 'strong', match: m };
      }
      // dur 다름 → 같은 날 다른 경기, 중복 아님
      continue;
    }

    // 신규 후보 dur 없음 (기존 경기 dur 유무 무관) → weak 경고
    return { level: 'weak', match: m };
  }

  return { level: 'none' };
}
