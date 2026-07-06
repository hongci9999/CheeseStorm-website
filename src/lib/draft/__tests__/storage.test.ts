// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSeries, saveSeries, clearSeries, STORAGE_KEY } from '../storage';
import type { Series } from '../types';

const sample: Series = {
  draftType: 'soft',
  bestOf: 5,
  blue: [{ id: 'a', name: '가나' }],
  red: [{ id: 'b', name: '다라' }],
  sets: [],
  current: null,
};

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('저장 후 로드하면 동일 데이터', () => {
    saveSeries(sample);
    expect(loadSeries()).toEqual(sample);
  });

  it('데이터 없으면 null', () => {
    expect(loadSeries()).toBeNull();
  });

  it('깨진 JSON이면 null(폴백)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid');
    expect(loadSeries()).toBeNull();
  });

  it('clearSeries는 키를 제거', () => {
    saveSeries(sample);
    clearSeries();
    expect(loadSeries()).toBeNull();
  });
});
