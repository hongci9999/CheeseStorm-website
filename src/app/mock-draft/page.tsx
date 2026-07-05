'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { mapImageUrl } from '@/lib/draft/map-image';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { DraftBoard } from '@/components/mock-draft/draft-board';
import { Scoreboard } from '@/components/mock-draft/scoreboard';
import { PickHistory } from '@/components/mock-draft/pick-history';
import { SeriesSummary } from '@/components/mock-draft/series-summary';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import { startSet, finishSet, undo as undoState } from '@/lib/draft/engine';
import { availableMaps } from '@/lib/draft/maps';
import { card, primaryBtn, secondaryBtn, field, pageTitle, sectionTitle, selectedOutline, teamColor } from '@/components/mock-draft/ui';
import type { Series, DraftState, DraftType, Team } from '@/lib/draft/types';

const DRAFT_LABELS: Record<DraftType, string> = {
  normal: '일반',
  soft: '소프트 피어리스',
  hard: '하드 피어리스',
};

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
    return <main style={{ padding: 'var(--sp-5)', maxWidth: 'var(--container)', margin: '0 auto' }}><SeriesSetup onStart={setSeries} /></main>;
  }

  const usedMaps = series.sets.map((s) => s.map);
  const maps = availableMaps(usedMaps);

  // 클린치 판정: Bo3 2승 / Bo5 3승 도달 시 시리즈 종료.
  const blueWins = series.sets.filter((s) => s.winner === 'blue').length;
  const redWins = series.sets.filter((s) => s.winner === 'red').length;
  const needed = series.bestOf === 3 ? 2 : 3;
  const seriesWinner: Team | null =
    blueWins >= needed ? 'blue' : redWins >= needed ? 'red' : null;

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
    <main style={{ padding: 'var(--sp-5)', maxWidth: 'var(--container)', margin: '0 auto', display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <h1 style={pageTitle}>
          모의 밴픽{' '}
          <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
            {DRAFT_LABELS[series.draftType]} · {`Bo${series.bestOf}`}
          </span>
        </h1>
        <button onClick={reset} style={secondaryBtn}>시리즈 초기화</button>
      </div>

      <Scoreboard series={series} />

      {seriesWinner && !series.current ? (
        <SeriesSummary series={series} winner={seriesWinner} />
      ) : !series.current ? (
        <section style={{ ...card, display: 'grid', gap: 'var(--sp-4)', maxWidth: 560 }}>
          <strong style={sectionTitle}>세트 {series.sets.length + 1} 설정</strong>
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>맵 선택</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
              {maps.map((m) => {
                const img = mapImageUrl(m);
                const isSel = m === map;
                return (
                  <button
                    key={m}
                    onClick={() => setMap(m)}
                    title={m}
                    style={{
                      position: 'relative',
                      padding: 0,
                      borderRadius: 'var(--r-md)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      outline: isSel ? selectedOutline : '1px solid var(--border-line)',
                      outlineOffset: isSel ? 1 : 0,
                      aspectRatio: '16 / 9',
                      transition: 'outline-color var(--dur-fast) var(--ease-out)',
                    }}
                  >
                    {img && <Image src={img} alt={m} fill sizes="120px" style={{ objectFit: 'cover' }} />}
                    <span style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0,
                      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: '#fff',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.82))', padding: '10px 6px 3px', textAlign: 'left',
                    }}>{m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>선픽</span>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {(['blue', 'red'] as const).map((t) => {
                const on = firstPick === t;
                return (
                  <button key={t} onClick={() => setFirstPick(t)}
                    style={{ ...secondaryBtn, color: teamColor(t),
                      borderColor: on ? teamColor(t) : 'var(--border-line)',
                      background: on ? `color-mix(in srgb, ${teamColor(t)} 14%, transparent)` : 'var(--surface-input)',
                      fontWeight: on ? 800 : 600 }}>
                    {t === 'blue' ? '블루' : '레드'}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={startCurrentSet} disabled={!map}
            style={{ ...primaryBtn, justifySelf: 'start', opacity: map ? 1 : 0.45, cursor: map ? 'pointer' : 'not-allowed' }}>세트 시작</button>
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

      {!seriesWinner && <PickHistory series={series} />}
    </main>
  );
}
