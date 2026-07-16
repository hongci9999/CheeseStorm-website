// 서버 컴포넌트 전용 캐시 — next/cache는 서버 전용이므로 firestore.ts와 분리.
// 클라이언트 컴포넌트에서 이 파일을 import하면 빌드 에러 발생 (의도된 동작).
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getMatches, getStreamers, getScrims } from './firestore';
import type { Match, Streamer } from './types';
import type { Scrim } from './scrim';

// ── Matches ───────────────────────────────────────────────────
// unstable_cache는 JSON 직렬화를 거치므로 Date → string 변환됨. 역직렬화 복원 필요.
const _getMatchesRaw = unstable_cache(
  () => getMatches(),
  ['matches'],
  { tags: ['matches'] },
);

type RawMatch = Omit<Match, 'date' | 'createdAt'> & { date: string | Date; createdAt: string | Date };

// 목록은 접힌 행에 필요한 정보만 — 개인 스탯(blueStats/redStats)은 제외해 payload 축소.
// 상세는 펼칠 때 클라이언트가 getMatch(id)로 단건 fetch (matches-client.tsx).
export async function getMatchesCachedServer(): Promise<Match[]> {
  const raw = await _getMatchesRaw() as RawMatch[];
  return raw.map(({ blueStats: _b, redStats: _r, ...m }) => ({
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

// ── Scrims (프로 스크림 밴픽 기록) ────────────────────────────
const _getScrimsRaw = unstable_cache(
  () => getScrims(),
  ['scrims'],
  { tags: ['scrims'] },
);

type RawScrim = Omit<Scrim, 'date' | 'createdAt'> & { date: string | Date; createdAt: string | Date };

export async function getScrimsCachedServer(): Promise<Scrim[]> {
  const raw = await _getScrimsRaw() as RawScrim[];
  return raw.map((s) => ({
    ...s,
    date: s.date instanceof Date ? s.date : new Date(s.date),
    createdAt: s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt),
  }));
}
