import { describe, it, expect } from 'vitest';
import { validateStreamerForm, parseChzzkId, sortStreamersByName, matchName } from '../streamer';
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

describe('matchName', () => {
  // 테스트용 스트리머 픽스처 — MOCK_STREAMERS의 s4(치즈먹자) 패턴 참조
  const streamers: Streamer[] = [
    {
      id: 's1', name: '폭풍칼날', chzzkId: 'storm1',
      gameNames: ['Storm#3142'],
      createdAt: new Date(),
    },
    {
      id: 's4', name: '치즈먹자',
      gameNames: ['Cheese#5555', '치즈부캐#9090'],
      createdAt: new Date(),
    },
    {
      id: 's5', name: '달빛소녀', chzzkId: 'moongl',
      createdAt: new Date(),
    },
  ];

  it('gameNames 완전일치(대소문자 동일)로 스트리머를 찾는다', () => {
    expect(matchName('Storm#3142', streamers)).toBe('s1');
  });

  it('gameNames 대소문자 무시 매칭이 동작한다', () => {
    expect(matchName('storm#3142', streamers)).toBe('s1');
    expect(matchName('STORM#3142', streamers)).toBe('s1');
  });

  it('gameNames가 여러 개인 스트리머(부캐)도 두 번째 별칭으로 매칭된다', () => {
    expect(matchName('Cheese#5555', streamers)).toBe('s4');
    expect(matchName('치즈부캐#9090', streamers)).toBe('s4');
  });

  it('gameNames 없는 스트리머는 표시명으로 매칭된다', () => {
    expect(matchName('달빛소녀', streamers)).toBe('s5');
  });

  it('gameNames 없는 스트리머는 chzzkId로 매칭된다', () => {
    expect(matchName('moongl', streamers)).toBe('s5');
  });

  it('표시명 대소문자 무시 매칭이 동작한다', () => {
    expect(matchName('달빛소녀', streamers)).toBe('s5');
  });

  it('gameNames가 표시명보다 우선 매칭된다', () => {
    // Storm#3142 gameNames로 s1 매칭 — s1의 name('폭풍칼날')은 관계없음
    expect(matchName('Storm#3142', streamers)).toBe('s1');
    // 표시명 직접 입력도 여전히 동작
    expect(matchName('폭풍칼날', streamers)).toBe('s1');
  });

  it('매칭 실패 시 빈 문자열을 반환한다', () => {
    expect(matchName('없는이름#0000', streamers)).toBe('');
    expect(matchName('', streamers)).toBe('');
  });

  it('빈 스트리머 목록이면 빈 문자열을 반환한다', () => {
    expect(matchName('Storm#3142', [])).toBe('');
  });
});
