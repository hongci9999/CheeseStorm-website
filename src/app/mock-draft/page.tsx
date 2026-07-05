'use client';

import { useEffect, useState } from 'react';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { DraftBoard } from '@/components/mock-draft/draft-board';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import { startSet, finishSet, undo as undoState } from '@/lib/draft/engine';
import { availableMaps } from '@/lib/draft/maps';
import type { Series, DraftState, Team } from '@/lib/draft/types';

export default function MockDraftPage() {
  const [series, setSeries] = useState<Series | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState('');
  const [firstPick, setFirstPick] = useState<Team>('blue');

  useEffect(() => {
    setSeries(loadSeries());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (series) saveSeries(series);
  }, [series, loaded]);

  if (!loaded) return null;

  function reset() {
    clearSeries();
    setSeries(null);
    setMap('');
  }

  if (!series) {
    return <main style={{ padding: 16 }}><SeriesSetup onStart={setSeries} /></main>;
  }

  const usedMaps = series.sets.map((s) => s.map);
  const maps = availableMaps(usedMaps);

  function startCurrentSet() {
    if (!series || !map) return;
    setSeries({ ...series, current: startSet(map, firstPick) });
  }

  function applyNext(next: DraftState) {
    if (!series) return;
    setSeries({ ...series, current: next });
  }

  function undoCurrent() {
    if (!series?.current) return;
    setSeries({ ...series, current: undoState(series.current) });
  }

  function finishCurrent(winner: Team) {
    if (!series?.current) return;
    const result = finishSet(series.current, winner);
    setSeries({ ...series, sets: [...series.sets, result], current: null });
    setMap('');
  }

  return (
    <main style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          모의 밴픽 · {series.draftType} · {`Bo${series.bestOf}`}
        </h1>
        <button onClick={reset}>시리즈 초기화</button>
      </div>

      {!series.current ? (
        <section style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          <strong>세트 {series.sets.length + 1} 설정</strong>
          <label>맵:{' '}
            <select value={map} onChange={(e) => setMap(e.target.value)}>
              <option value="">맵 선택</option>
              {maps.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>선픽:{' '}
            <select value={firstPick} onChange={(e) => setFirstPick(e.target.value as Team)}>
              <option value="blue">블루</option>
              <option value="red">레드</option>
            </select>
          </label>
          <button onClick={startCurrentSet} disabled={!map}>세트 시작</button>
        </section>
      ) : (
        <DraftBoard
          series={series}
          state={series.current}
          onApply={applyNext}
          onUndo={undoCurrent}
          onFinish={finishCurrent}
        />
      )}
    </main>
  );
}
