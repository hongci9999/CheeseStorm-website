import { describe, it, expect } from 'vitest';
import {
  normalizeOcrKey,
  resolveStreamerId,
  resolveHeroName,
  shouldRecordStreamerCorrection,
  shouldRecordHeroCorrection,
  EMPTY_OCR_CORRECTIONS,
} from '../ocr-corrections';
import type { Streamer } from '../types';

const streamers: Streamer[] = [
  { id: 's1', name: '폭풍칼날', gameNames: ['Storm#3142'], createdAt: new Date() },
];

describe('normalizeOcrKey', () => {
  it('공백을 정규화하고 소문자로 만든다', () => {
    expect(normalizeOcrKey('  Storm#3142  ')).toBe('storm#3142');
    expect(normalizeOcrKey('스 터코프')).toBe('스 터코프');
  });
});

describe('resolveStreamerId', () => {
  it('gameNames로 매칭한다', () => {
    expect(resolveStreamerId('Storm#3142', streamers, EMPTY_OCR_CORRECTIONS)).toBe('s1');
  });

  it('OCR 교정맵을 gameNames보다 우선하지 않고 교정맵을 사용한다', () => {
    const corrections = { streamers: { 'storm칼날': 's1' }, heroes: {} };
    expect(resolveStreamerId('Storm칼날', streamers, corrections)).toBe('s1');
  });
});

describe('resolveHeroName', () => {
  it('교정맵에 있으면 정답 영웅명을 반환한다', () => {
    const corrections = { streamers: {}, heroes: { '스터코프': '스투코프' } };
    expect(resolveHeroName('스터코프', corrections)).toBe('스투코프');
  });
});

describe('shouldRecordStreamerCorrection', () => {
  it('AI 오답을 사용자가 올바른 스트리머로 지정하면 기록한다', () => {
    expect(shouldRecordStreamerCorrection('Storm칼날', 's1', streamers, EMPTY_OCR_CORRECTIONS)).toBe(true);
  });

  it('이미 gameNames로 매칭되면 기록하지 않는다', () => {
    expect(shouldRecordStreamerCorrection('Storm#3142', 's1', streamers, EMPTY_OCR_CORRECTIONS)).toBe(false);
  });

  it('동일 교정이 이미 있으면 기록하지 않는다', () => {
    const corrections = { streamers: { 'storm칼날': 's1' }, heroes: {} };
    expect(shouldRecordStreamerCorrection('Storm칼날', 's1', streamers, corrections)).toBe(false);
  });
});

describe('shouldRecordHeroCorrection', () => {
  it('알려진 영웅으로 수정하면 기록한다', () => {
    expect(shouldRecordHeroCorrection('스터코프', '스투코프', EMPTY_OCR_CORRECTIONS)).toBe(true);
  });

  it('동일 이름이면 기록하지 않는다', () => {
    expect(shouldRecordHeroCorrection('겐지', '겐지', EMPTY_OCR_CORRECTIONS)).toBe(false);
  });
});
