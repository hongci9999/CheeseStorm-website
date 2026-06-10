import type { Role } from './types';

type Result = { valid: true } | { valid: false; error: string };

export function validateStreamerForm(name: string, role?: Role): Result {
  if (!name.trim()) return { valid: false, error: '이름을 입력해주세요.' };
  return { valid: true };
}
