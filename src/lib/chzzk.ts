// 치지직 Open API 채널 정보 조회 (서버 전용).
// 채널 정보 조회는 Client 인증(Client-Id/Client-Secret 헤더)만 필요 — OAuth 토큰 불필요.
// 시크릿이 노출되면 안 되므로 이 모듈은 서버(API 라우트)에서만 import한다.
// 문서: https://chzzk.gitbook.io/chzzk/chzzk-api/channel

const OPENAPI_BASE = 'https://openapi.chzzk.naver.com';
const MAX_IDS_PER_REQUEST = 20; // 채널 정보 조회 1회 최대 20개

export interface ChzzkChannelProfile {
  channelId: string;
  name: string;
  imageUrl: string;     // 비어있을 수 있음 (기본 프로필)
  verified: boolean;
  followerCount: number;
}

// 환경변수에 Client 자격증명이 모두 설정됐는지.
export function isChzzkConfigured(): boolean {
  return !!(process.env.CHZZK_CLIENT_ID && process.env.CHZZK_CLIENT_SECRET);
}

// openapi 응답 공통 래퍼: { code, message, content: { data: [...] } }
interface ChannelsResponse {
  content?: { data?: ChzzkChannelRaw[] };
}
interface ChzzkChannelRaw {
  channelId: string;
  channelName: string;
  channelImageUrl: string;
  followerCount: number;
  verifiedMark: boolean;
}

// 20개씩 청크 분할.
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 채널 ID 목록 → channelId별 프로필 맵. 미설정·실패 시 빈 맵.
// 중복 ID는 제거하고, 20개 초과 시 여러 번 나눠 호출한다.
export async function fetchChannelProfiles(
  channelIds: string[],
): Promise<Record<string, ChzzkChannelProfile>> {
  const ids = Array.from(new Set(channelIds.map((s) => s.trim()).filter(Boolean)));
  if (ids.length === 0 || !isChzzkConfigured()) return {};

  const headers = {
    'Client-Id': process.env.CHZZK_CLIENT_ID as string,
    'Client-Secret': process.env.CHZZK_CLIENT_SECRET as string,
    'Content-Type': 'application/json',
  };

  const result: Record<string, ChzzkChannelProfile> = {};

  for (const group of chunk(ids, MAX_IDS_PER_REQUEST)) {
    const params = new URLSearchParams();
    for (const id of group) params.append('channelIds', id);

    let res: Response;
    try {
      res = await fetch(`${OPENAPI_BASE}/open/v1/channels?${params}`, { headers });
    } catch {
      continue; // 네트워크 오류는 해당 청크만 건너뜀
    }
    if (!res.ok) continue;

    let json: ChannelsResponse;
    try {
      json = (await res.json()) as ChannelsResponse;
    } catch {
      continue;
    }

    for (const ch of json.content?.data ?? []) {
      result[ch.channelId] = {
        channelId: ch.channelId,
        name: ch.channelName,
        imageUrl: ch.channelImageUrl ?? '',
        verified: !!ch.verifiedMark,
        followerCount: ch.followerCount ?? 0,
      };
    }
  }

  return result;
}
