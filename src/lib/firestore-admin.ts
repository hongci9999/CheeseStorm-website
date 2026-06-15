// 서버 전용 Firestore write — Admin SDK 사용으로 보안 규칙 우회.
// 클라이언트 컴포넌트에서 직접 import 금지. API 라우트에서만 사용.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { getStreamers, getMatches, getCuratedTierLists, packMatchForStore, type PrecomputedProfile } from './firestore';
import { calcPlayerStats } from './tier';
import { calcHeroTiers } from './hero-tier';
import { normalizeOcrKey } from './ocr-corrections';
import { emptyTierLists, CURATED_TIER_ORDER } from './curated-tier';
import { kdaFor, getRecentMatches } from './profile';
import { fineRoleAffinity } from './heroes';
import { aggregateHeroStats } from './hero-stats';
import { computeRelations } from './relations';
import { mapWinRates } from './map-stats';
import type { Match, Streamer, CuratedTierLists } from './types';

type StoredPick = { id: string; hero: string };
function packTeam(team: [string, string][]): StoredPick[] {
  return team.map(([id, hero]) => ({ id, hero }));
}

async function refreshStats(): Promise<void> {
  try {
    const [streamers, matches] = await Promise.all([getStreamers({ fresh: true }), getMatches()]);
    const playerStats = calcPlayerStats(streamers, matches);
    const heroTiers = calcHeroTiers(matches);

    const profiles: Record<string, PrecomputedProfile> = {};
    for (const s of streamers) {
      const played = getRecentMatches(s.id, matches, Infinity);
      const { synergy, nemesis } = computeRelations(s.id, streamers, matches);
      profiles[s.id] = {
        streamerName: s.name,
        ...(s.profileImageUrl !== undefined ? { profileImageUrl: s.profileImageUrl } : {}),
        ...(s.gameNames !== undefined ? { gameNames: s.gameNames } : {}),
        ...(s.accountLevel !== undefined ? { accountLevel: s.accountLevel } : {}),
        kda: kdaFor(matches, s.id),
        roleAffinity: fineRoleAffinity(matches, s.id),
        heroAggregates: aggregateHeroStats(s.id, matches),
        synergy,
        nemesis,
        maps: mapWinRates(s.id, matches),
        recentMatches: played.slice(0, 6).map(packMatchForStore),
        allMatches: played.map(packMatchForStore),
      };
    }

    const clean = (v: unknown) => JSON.parse(JSON.stringify(v));
    await getAdminDb().collection('stats').doc('current').set({
      playerStats: clean(playerStats),
      heroTiers: clean(heroTiers),
      profiles: clean(profiles),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[refreshStats] 집계 실패:', err);
  }
}

export async function saveCuratedTierLists(lists: CuratedTierLists): Promise<void> {
  await getAdminDb().collection('curatedTiers').doc('current').set(
    { lists, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

async function removeCuratedPlacement(streamerId: string): Promise<void> {
  const current = await getCuratedTierLists();
  const has = CURATED_TIER_ORDER.some((t) => current[t].includes(streamerId));
  if (!has) return;
  const next = emptyTierLists();
  for (const tier of CURATED_TIER_ORDER) {
    next[tier] = current[tier].filter((id) => id !== streamerId);
  }
  await saveCuratedTierLists(next);
}

// ── Streamers ────────────────────────────────────────────────

export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await getAdminDb().collection('streamers').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  void refreshStats();
  return ref.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).delete();
  await removeCuratedPlacement(id);
  void refreshStats();
}

export async function updateStreamerInfo(id: string, name: string, accountLevel?: number): Promise<void> {
  const payload: Record<string, unknown> = { name };
  if (accountLevel !== undefined) payload.accountLevel = accountLevel;
  await getAdminDb().collection('streamers').doc(id).update(payload);
  void refreshStats();
}

export async function updateStreamerGameNames(id: string, gameNames: string[]): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({ gameNames });
  void refreshStats();
}

export async function updateStreamerProfileImage(id: string, imageUrl: string): Promise<void> {
  await getAdminDb().collection('streamers').doc(id).update({
    profileImageUrl: imageUrl,
    profileImageUpdatedAt: FieldValue.serverTimestamp(),
  });
  void refreshStats();
}

// ── Matches ──────────────────────────────────────────────────

export async function addMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<string> {
  const payload: Record<string, unknown> = {
    ...data,
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
    createdAt: FieldValue.serverTimestamp(),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  const ref = await getAdminDb().collection('matches').add(payload);
  void refreshStats();
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await getAdminDb().collection('matches').doc(id).delete();
  void refreshStats();
}

export async function updateMatch(id: string, data: Omit<Match, 'id' | 'createdAt'>): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    blueTeam: packTeam(data.blueTeam),
    redTeam: packTeam(data.redTeam),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  await getAdminDb().collection('matches').doc(id).update(payload);
  void refreshStats();
}

export async function updateMatchDate(id: string, date: Date): Promise<void> {
  await getAdminDb().collection('matches').doc(id).update({ date });
  void refreshStats();
}

// ── Curated tiers already exported above ────────────────────

// ── OCR ──────────────────────────────────────────────────────

export async function upsertOcrCorrection(
  kind: 'streamer' | 'hero', wrong: string, correct: string,
): Promise<void> {
  const key = normalizeOcrKey(wrong);
  if (!key || !correct.trim()) return;
  const field = kind === 'streamer' ? 'streamers' : 'heroes';
  await getAdminDb().collection('ocrCorrections').doc('global').set(
    { [`${field}.${key}`]: correct.trim(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
