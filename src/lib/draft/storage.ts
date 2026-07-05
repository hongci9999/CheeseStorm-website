import type { Series } from './types';

export const STORAGE_KEY = 'cheesestorm.mockdraft.v1';

// 시리즈 로드. 없거나 파싱 실패 시 null(조용히 폴백).
export function loadSeries(): Series | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Series;
  } catch {
    return null;
  }
}

// 시리즈 저장 (Date 필드 없음 → 순수 JSON).
export function saveSeries(series: Series): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
}

// 시리즈 초기화.
export function clearSeries(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
