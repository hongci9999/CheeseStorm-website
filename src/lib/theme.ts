export type Theme = 'dark' | 'light';

export function resolveTheme(stored: string | null): Theme {
  return stored === 'light' ? 'light' : 'dark';
}
