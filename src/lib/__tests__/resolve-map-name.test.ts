import { describe, expect, it } from 'vitest';
import { resolveMapName } from '../draft/maps';

describe('resolveMapName', () => {
  it('정식 전장명은 그대로 반환', () => {
    expect(resolveMapName('영원의 전쟁터')).toBe('영원의 전쟁터');
  });

  it('과거 오기(전장터)를 정식명으로 교정', () => {
    expect(resolveMapName('영원의 전장터')).toBe('영원의 전쟁터');
  });

  it('공백 차이만 있으면 정식명으로 매칭', () => {
    expect(resolveMapName('영원의  전쟁터')).toBe('영원의 전쟁터');
    expect(resolveMapName(' 파멸의 탑 ')).toBe('파멸의 탑');
  });

  it('알 수 없는 값은 원본 유지, 빈 값은 빈 문자열', () => {
    expect(resolveMapName('이상한 맵')).toBe('이상한 맵');
    expect(resolveMapName('  ')).toBe('');
  });
});
