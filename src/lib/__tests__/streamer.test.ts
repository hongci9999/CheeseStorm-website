import { describe, it, expect } from 'vitest';
import { validateStreamerForm, parseChzzkId, sortStreamersByName } from '../streamer';
import type { Streamer } from '../types';

// 테스트용 최소 Streamer 픽스처 생성 헬퍼
function makeStreamer(name: string, id = name): Streamer {
  return { id, name, createdAt: new Date() } as unknown as Streamer;
}

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

describe('sortStreamersByName', () => {
  it('한글 이름을 가나다순으로 정렬한다', () => {
    const input = [makeStreamer('폭풍칼날'), makeStreamer('나루'), makeStreamer('가람')];
    const result = sortStreamersByName(input);
    expect(result.map(s => s.name)).toEqual(['가람', '나루', '폭풍칼날']);
  });

  it('영문 이름을 알파벳순으로 정렬한다', () => {
    const input = [makeStreamer('Zeta'), makeStreamer('Alpha'), makeStreamer('Mike')];
    const result = sortStreamersByName(input);
    expect(result.map(s => s.name)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });

  it('한글과 영문이 혼재할 때 올바르게 정렬한다', () => {
    const input = [makeStreamer('치즈'), makeStreamer('Alpha'), makeStreamer('나루'), makeStreamer('Zeta')];
    const result = sortStreamersByName(input);
    // ko 로캘: 영문이 한글보다 앞에 오거나 locale 기준 정렬됨 — 안정적으로 순서 일관성만 확인
    const names = result.map(s => s.name);
    // 한글끼리 상대 순서: 나루 < 치즈
    expect(names.indexOf('나루')).toBeLessThan(names.indexOf('치즈'));
    // 영문끼리 상대 순서: Alpha < Zeta
    expect(names.indexOf('Alpha')).toBeLessThan(names.indexOf('Zeta'));
  });

  it('원본 배열을 변경하지 않는다', () => {
    const input = [makeStreamer('나루'), makeStreamer('가람')];
    const original = [...input];
    sortStreamersByName(input);
    expect(input.map(s => s.name)).toEqual(original.map(s => s.name));
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(sortStreamersByName([])).toEqual([]);
  });

  it('단일 요소 배열은 그대로 반환한다', () => {
    const input = [makeStreamer('가람')];
    expect(sortStreamersByName(input).map(s => s.name)).toEqual(['가람']);
  });
});
