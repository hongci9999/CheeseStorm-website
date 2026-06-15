// 클라이언트 → 서버 API 라우트 경유 write 함수.
// firestore.ts의 동일 함수를 대체 — 직접 Firestore 접근 없이 JWT 인증을 거침.

import type { Match, Streamer, CuratedTierLists } from './types';
import {
  invalidateStreamersCache,
  invalidateMatchesCache,
  invalidateCuratedListsCache,
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
  return res.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'DELETE');
  invalidateStreamersCache();
  invalidateCuratedListsCache();
}

export async function updateStreamerInfo(
  id: string, name: string, accountLevel?: number,
): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'info', name, accountLevel });
  invalidateStreamersCache();
}

export async function updateStreamerGameNames(id: string, gameNames: string[]): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'gameNames', gameNames });
  invalidateStreamersCache();
}

export async function updateStreamerProfileImage(id: string, imageUrl: string): Promise<void> {
  await apiFetch(`/api/streamers/${id}`, 'PATCH', { action: 'profileImage', imageUrl });
  invalidateStreamersCache();
}

// ── Matches ──────────────────────────────────────────────────
export async function addMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<string> {
  const res = await apiFetch('/api/matches', 'POST', data) as { id: string };
  invalidateMatchesCache();
  return res.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'DELETE');
  invalidateMatchesCache();
}

export async function updateMatch(id: string, data: Omit<Match, 'id' | 'createdAt'>): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'PATCH', { action: 'update', ...data });
  invalidateMatchesCache();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await apiFetch(`/api/matches/${id}`, 'PATCH', { action: 'date', date: date.toISOString() });
  invalidateMatchesCache();
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
}
