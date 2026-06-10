import { describe, it, expect } from 'vitest';
import { validateStreamerForm } from '../streamer';

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

  it('유효한 이름과 역할이면 valid를 반환한다', () => {
    const result = validateStreamerForm('한빛', '지원가');
    expect(result.valid).toBe(true);
  });
});
