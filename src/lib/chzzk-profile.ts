import type { Streamer } from './types';

// 프로필 사진 주기 갱신 TTL — 마지막 갱신 후 이 기간이 지나면 다시 조회.
// 7일: 닉네임/사진 변경은 드물고, 유휴 비용 0원 정책상 과한 호출을 피한다.
export const PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// API 라우트가 돌려주는 채널별 프로필.
export interface ChzzkProfileLite {
  name: string;
  imageUrl: string;
  verified?: boolean;
  followerCount?: number;
}

// 갱신이 필요한가? chzzkId가 없으면 대상 아님.
// 한 번도 조회 안 했거나(updatedAt 없음) TTL이 지났으면 true.
export function isProfileStale(s: Streamer, now: number = Date.now()): boolean {
  if (!s.chzzkId) return false;
  if (!s.profileImageUpdatedAt) return true;
  return now - s.profileImageUpdatedAt.getTime() > PROFILE_TTL_MS;
}

// 채널 ID 목록으로 프로필 일괄 조회. 실패·미설정 시 빈 객체.
export async function fetchChzzkProfiles(
  channelIds: string[],
): Promise<Record<string, ChzzkProfileLite>> {
  const ids = Array.from(new Set(channelIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const res = await fetch(`/api/chzzk-profile?channelIds=${encodeURIComponent(ids.join(','))}`);
    if (!res.ok) return {};
    const json = (await res.json()) as { profiles?: Record<string, ChzzkProfileLite> };
    return json.profiles ?? {};
  } catch {
    return {};
  }
}
