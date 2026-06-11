import { describe, it, expect } from 'vitest';
import { validateStreamerForm, parseChzzkId } from '../streamer';

describe('validateStreamerForm', () => {
  it('빈 이름이면 invalid를 반환한다', () => {
    const result = validateStreamerForm('');
    expect(result.valid).toBe(false);
  });

  it('공백만 있는 이름이면 invalid를 반환한다', () => {
    const result = validateStreamerForm('   ');
    expect(result.valid).toBe(false);
  });

  it('유효한 이름이면 valid를 반환한다', () => {
    const result = validateStreamerForm('폭풍칼날');
    expect(result.valid).toBe(true);
  });

  it('계정레벨이 양의 정수면 valid', () => {
    expect(validateStreamerForm('한빛', '523').valid).toBe(true);
  });

  it('계정레벨이 숫자가 아니거나 0 이하면 invalid', () => {
    expect(validateStreamerForm('한빛', 'abc').valid).toBe(false);
    expect(validateStreamerForm('한빛', '-5').valid).toBe(false);
    expect(validateStreamerForm('한빛', '0').valid).toBe(false);
  });

  it('계정레벨 미입력(빈 문자열)은 valid', () => {
    expect(validateStreamerForm('한빛', '').valid).toBe(true);
  });
});

describe('parseChzzkId', () => {
  it('치지직 채널 URL에서 ID를 추출한다', () => {
    expect(parseChzzkId('https://chzzk.naver.com/abc123def')).toBe('abc123def');
    expect(parseChzzkId('https://chzzk.naver.com/abc123def/')).toBe('abc123def');
  });

  it('URL이 아닌 ID는 그대로 반환한다', () => {
    expect(parseChzzkId('abc123def')).toBe('abc123def');
  });

  it('빈 입력은 undefined', () => {
    expect(parseChzzkId('')).toBeUndefined();
    expect(parseChzzkId('   ')).toBeUndefined();
  });
});
