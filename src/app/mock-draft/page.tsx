'use client';

import { useEffect, useState } from 'react';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import type { Series } from '@/lib/draft/types';

export default function MockDraftPage() {
  const [series, setSeries] = useState<Series | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 진입 시 localStorage 복원.
  useEffect(() => {
    setSeries(loadSeries());
    setLoaded(true);
  }, []);

  // 변경마다 저장.
  useEffect(() => {
    if (!loaded) return;
    if (series) saveSeries(series);
  }, [series, loaded]);

  function reset() {
    clearSeries();
    setSeries(null);
  }

  if (!loaded) return null;

  if (!series) {
    return (
      <main style={{ padding: 16 }}>
        <SeriesSetup onStart={setSeries} />
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>모의 밴픽 진행 중</h1>
        <button onClick={reset}>시리즈 초기화</button>
      </div>
      {/* Task 9~10에서 세트 셋업/드래프트 보드/스코어보드로 대체 */}
      <p style={{ marginTop: 12 }}>
        종류: {series.draftType} · {`Bo${series.bestOf}`} · 블루 {series.blue.length}명 / 레드 {series.red.length}명
      </p>
    </main>
  );
}
