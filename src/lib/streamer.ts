import type { Streamer } from './types';

type Result = { valid: true } | { valid: false; error: string };

// 추가폼 검증. 롤은 내전 기록에서 파생하므로 입력받지 않음.
export function validateStreamerForm(name: string, accountLevel?: string): Result {
  if (!name.trim()) return { valid: false, error: '이름을 입력해주세요.' };
  if (accountLevel && accountLevel.trim()) {
    const n = Number(accountLevel);
    if (!Number.isInteger(n) || n <= 0)
      return { valid: false, error: '계정레벨은 양의 정수여야 합니다.' };
  }
  return { valid: true };
}

// 채널주소 입력에서 치지직 채널 ID 추출. URL이 아니면 그대로, 빈값은 undefined.
export function parseChzzkId(input: string): string | undefined {
  const t = input.trim();
  if (!t) return undefined;
  const m = t.match(/chzzk\.naver\.com\/([^/?#\s]+)/);
  return m ? m[1] : t;
}

// 스트리머 배열을 이름 기준 가나다순으로 정렬한 복사본 반환.
// 한국어 로캘(localeCompare 'ko') 사용 — 동점 시 원본 순서 유지(안정 정렬).
export function sortStreamersByName(list: Streamer[]): Streamer[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
