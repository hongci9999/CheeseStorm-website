// 클라이언트 → 서버 API 라우트 경유 write 함수.
// firestore.ts의 동일 함수를 대체 — 직접 Firestore 접근 없이 JWT 인증을 거침.

import type { Match, Streamer, CuratedTierLists } from './types';
import type { Scrim } from './scrim';
import {
  invalidateStreamersCache,
  invalidateMatchesCache,
  invalidateCuratedListsCache,
  invalidateOcrCorrectionsCache,
  invalidateStatsCache,
} from './firestore';

async function apiFetch(path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? '요청 실패');
  }
  return res.json();
}

// ── Streamers ────────────────────────────────────────────────
export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const res = await apiFetch('/api/streamers', 'POST', data) as { id: string };
  invalidateStreamersCache();
  invalidateStatsCache();
  return res.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'DELETE');
  invalidateStreamersCache();
  invalidateStatsCache();
  invalidateCuratedListsCache();
}

export async function updateStreamerInfo(
  id: string, name: string, accountLevel?: number,
): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'info', name, accountLevel });
  invalidateStreamersCache();
  invalidateStatsCache();
}

export async function updateStreamerGameNames(id: string, gameNames: string[]): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'gameNames', gameNames });
  invalidateStreamersCache();
  invalidateStatsCache();
}

export async function updateStreamerProfileImage(id: string, imageUrl: string): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'profileImage', imageUrl });
  invalidateStreamersCache();
  invalidateStatsCache();
}

// ── Matches ──────────────────────────────────────────────────
// tournamentTeams: 대회 경기로 태깅할 때 { blue: teamId, red: teamId }.
// updateMatch에서 null을 넘기면 기존 대회 태그 해제, undefined면 기존 태그 유지(건드리지 않음).
export type TournamentTeamsPayload = { blue: string; red: string } | null;

export async function addMatch(
  data: Omit<Match, 'id' | 'createdAt'>, tournamentTeams?: TournamentTeamsPayload,
): Promise<string> {
  const res = await apiFetch('/api/matches', 'POST', { ...data, tournamentTeams }) as { id: string };
  invalidateMatchesCache();
  invalidateStatsCache();
  return res.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'DELETE');
  invalidateMatchesCache();
  invalidateStatsCache();
}

export async function updateMatch(
  id: string, data: Omit<Match, 'id' | 'createdAt'>, tournamentTeams?: TournamentTeamsPayload,
): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'PATCH', { action: 'update', ...data, tournamentTeams });
  invalidateMatchesCache();
  invalidateStatsCache();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'PATCH', { action: 'date', date: date.toISOString() });
  invalidateMatchesCache();
  invalidateStatsCache();
}

// ── Scrims (프로 스크림 밴픽 기록) ───────────────────────────
export async function addScrim(data: Omit<Scrim, 'id' | 'createdAt'>): Promise<string> {
  const res = await apiFetch('/api/scrims', 'POST', {
    ...data,
    date: data.date.toISOString(),
  }) as { id: string };
  return res.id;
}

// 여러 스크림을 한 세트로 묶는다(seriesId 공유) — 과거 기록 등 수동 정리용.
export async function mergeScrimsIntoSeries(ids: string[]): Promise<void> {
  await apiFetch('/api/scrims/series', 'PATCH', { ids, seriesId: crypto.randomUUID() });
}

export async function deleteScrim(id: string): Promise<void> {
  await apiFetch(`/api/scrims/${id}`, 'DELETE');
}

// ── Curated tiers ────────────────────────────────────────────
export async function saveCuratedTierLists(lists: CuratedTierLists): Promise<void> {
  await apiFetch('/api/curated-tiers', 'PUT', lists);
  invalidateCuratedListsCache();
}

// ── OCR ──────────────────────────────────────────────────────
export async function upsertOcrCorrection(
  kind: 'streamer' | 'hero', wrong: string, correct: string,
): Promise<void> {
  await apiFetch('/api/ocr-corrections', 'POST', { kind, wrong, correct });
  invalidateOcrCorrectionsCache();
}
