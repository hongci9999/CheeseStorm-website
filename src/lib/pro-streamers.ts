import type { CSSProperties } from 'react';

// 전프로 스트리머 — 개인 프로필에 트로피 스티커 표시
const PRO_NAMES = new Set(['교차', 'ttsst']);
const PRO_CHZZK_IDS = new Set(['ttsst']);

export function isProStreamer(streamer: { name: string; chzzkId?: string }): boolean {
  const name = streamer.name.trim();
  if (PRO_NAMES.has(name)) return true;
  if (name.toLowerCase() === 'ttsst') return true;

  const id = streamer.chzzkId?.trim().toLowerCase();
  return !!id && PRO_CHZZK_IDS.has(id);
}
