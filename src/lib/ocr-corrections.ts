import { isKnownHero } from './heroes';
import { matchBattleTag } from './streamer';
import type { OcrCorrections, Streamer } from './types';

export const EMPTY_OCR_CORRECTIONS: OcrCorrections = { streamers: {}, heroes: {} };

// OCR 오답 조회용 키 — 공백 정규화 + 소문자.
export function normalizeOcrKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

// AI가 반환한 스트리머명 → streamerId. gameNames → OCR 교정맵 순.
export function resolveStreamerId(
  extracted: string,
  streamers: Streamer[],
  corrections: OcrCorrections,
): string {
  const key = normalizeOcrKey(extracted);
  if (!key) return '';
  if (corrections.streamers[key]) return corrections.streamers[key];
  return matchBattleTag(extracted, streamers);
}

// AI가 반환한 영웅명 → 교정된 영웅명. 교정맵 → 알려진 영웅 그대로.
export function resolveHeroName(extracted: string, corrections: OcrCorrections): string {
  const trimmed = extracted.trim();
  if (!trimmed) return '';
  const key = normalizeOcrKey(trimmed);
  if (corrections.heroes[key]) return corrections.heroes[key];
  return trimmed;
}

// 사용자가 스트리머를 수동 지정했을 때 OCR 오답을 기록할지 판단.
export function shouldRecordStreamerCorrection(
  extracted: string,
  streamerId: string,
  streamers: Streamer[],
  corrections: OcrCorrections,
): boolean {
  const key = normalizeOcrKey(extracted);
  if (!key || !streamerId) return false;
  if (corrections.streamers[key] === streamerId) return false;
  return matchBattleTag(extracted, streamers) !== streamerId;
}

// 사용자가 영웅명을 수정했을 때 OCR 오답을 기록할지 판단.
export function shouldRecordHeroCorrection(
  extractedHero: string,
  hero: string,
  corrections: OcrCorrections,
): boolean {
  const wrongKey = normalizeOcrKey(extractedHero);
  const correct = hero.trim();
  if (!wrongKey || !correct) return false;
  if (corrections.heroes[wrongKey] === correct) return false;
  if (wrongKey === normalizeOcrKey(correct)) return false;
  return isKnownHero(correct);
}
