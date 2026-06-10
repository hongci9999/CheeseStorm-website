import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../theme';

describe('resolveTheme', () => {
  it('저장값이 없으면 dark를 반환한다', () => {
    expect(resolveTheme(null)).toBe('dark');
  });

  it("'light' 저장값이면 light를 반환한다", () => {
    expect(resolveTheme('light')).toBe('light');
  });

  it("'dark' 저장값이면 dark를 반환한다", () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('알 수 없는 값이면 dark로 폴백한다', () => {
    expect(resolveTheme('invalid')).toBe('dark');
  });
});
