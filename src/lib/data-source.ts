// 테스트용 데이터 소스 토글 — 더미(mock) vs 실제 Firestore 강제 선택.
// 쿠키 기반이라 클라이언트 페이지·서버 컴포넌트(상세 페이지) 모두에서 읽힌다.
// next/headers·firebase를 import하지 않아 양쪽 번들에서 안전.

export const DATA_SOURCE_COOKIE = 'cs-ds';

export type DataSource = 'mock' | 'firebase';

// 쿠키 원시값 → DataSource | null(미설정/무효)
export function parseDataSource(v?: string | null): DataSource | null {
  return v === 'mock' || v === 'firebase' ? v : null;
}

// 최종 판정: override 우선, 없으면 env 설정 여부로 기본값(설정됨=firebase, 아니면 mock)
export function resolveUseMock(override: DataSource | null, configured: boolean): boolean {
  if (override) return override === 'mock';
  return !configured;
}

// ── 클라이언트 전용 (document.cookie) ──
export function readDataSourceCookieClient(): DataSource | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)cs-ds=([^;]+)/);
  return parseDataSource(m ? decodeURIComponent(m[1]) : null);
}

export function writeDataSourceCookieClient(v: DataSource): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${DATA_SOURCE_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
}
