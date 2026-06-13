// 치지직 채널 ID → 앱 역할 해석.
// 로그인 시 1회 결정 후 JWT에 캐싱 → 매 요청마다 Firestore 조회 없음.

import type { AppRole } from './session';
import { getStreamerByChzzkId } from './firestore';

export type { AppRole };

export async function resolveRole(chzzkId: string): Promise<AppRole> {
  if (chzzkId === process.env.ADMIN_CHZZK_ID) return 'admin';
  const streamer = await getStreamerByChzzkId(chzzkId);
  return streamer ? 'streamer' : 'viewer';
}
