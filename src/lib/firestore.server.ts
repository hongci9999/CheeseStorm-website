// 서버 컴포넌트 전용 캐시 — next/cache는 서버 전용이므로 firestore.ts와 분리.
// 클라이언트 컴포넌트에서 이 파일을 import하면 빌드 에러 발생 (의도된 동작).
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getMatches, getStreamers } from './firestore';
import type { Match, Streamer } from './types';

// ── Matches ───────────────────────────────────────────────────
// unstable_cache는 JSON 직렬화를 거치므로 Date → string 변환됨. 역직렬화 복원 필요.
const _getMatchesRaw = unstable_cache(
  () => getMatches(),
  ['matches'],
  { tags: ['matches'] },
);

type RawMatch = Omit<Match, 'date' | 'createdAt'> & { date: string | Date; createdAt: string | Date };

export async function getMatchesCachedServer(): Promise<Match[]> {
  const raw = await _getMatchesRaw() as RawMatch[];
  return raw.map(m => ({
    ...m,
    date: m.date instanceof Date ? m.date : new Date(m.date),
    createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt),
  }));
}

// ── Streamers ─────────────────────────────────────────────────
// 경기기록 페이지에서 Streamer.createdAt 미사용 → Date 복원 불필요
const _getStreamersRaw = unstable_cache(
  () => getStreamers(),
  ['streamers'],
  { tags: ['streamers'] },
);

export const getStreamersCachedServer = _getStreamersRaw as () => Promise<Streamer[]>;
