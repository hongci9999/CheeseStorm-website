'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { mapImageUrl } from '@/lib/draft/map-image';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { DraftBoard } from '@/components/mock-draft/draft-board';
import { PickHistory } from '@/components/mock-draft/pick-history';
import { SeriesSummary } from '@/components/mock-draft/series-summary';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import { startSet, finishSet, undo as undoState, currentStep } from '@/lib/draft/engine';
import { availableMaps } from '@/lib/draft/maps';
import { card, primaryBtn, secondaryBtn, pageTitle, selectedOutline, teamColor, teamLabel } from '@/components/mock-draft/ui';
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
  const [mapPage, setMapPage] = useState(0);

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
    const result = finishSet(series.current, winner, series);
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

      {series.current && (() => {
        const cur = currentStep(series.current);
        const label = cur
          ? `${teamLabel(series, cur.team)} ${cur.kind === 'ban' ? '밴' : '픽'} 차례`
          : '드래프트 완료';
        return (
          <SetHeaderBar series={series} blueWins={blueWins} redWins={redWins}
            firstPick={series.current.firstPick} onFirstPick={() => {}} centerLabel={label}
            highlightSide={cur?.team ?? series.current.firstPick} mapName={series.current.map} />
        );
      })()}

      <div style={{ minHeight: 720, display: 'grid', alignContent: 'start' }}>
        {seriesWinner && !series.current ? (
          <SeriesSummary series={series} winner={seriesWinner} />
        ) : !series.current ? (
          <section style={{ display: 'grid', gap: 'var(--sp-5)' }}>
            {/* 스코어 + 선픽 바 */}
            <SetHeaderBar series={series} blueWins={blueWins} redWins={redWins}
              firstPick={firstPick} onFirstPick={setFirstPick} />

            {/* 맵 카드 6개/페이지 + 페이지 넘김 */}
            <MapPager maps={maps} map={map} onPick={setMap} page={mapPage} onPage={setMapPage} />

            <button onClick={startCurrentSet} disabled={!map}
              style={{ ...primaryBtn, justifySelf: 'center', minWidth: 220,
                opacity: map ? 1 : 0.45, cursor: map ? 'pointer' : 'not-allowed' }}>세트 시작</button>
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
      </div>

      {!seriesWinner && <PickHistory series={series} />}
    </main>
  );
}

// 스코어(승수 박스) + 선픽 바. 선픽 사이드로 갈수록 진해지는 그라데이션.
function SetHeaderBar({ series, blueWins, redWins, firstPick, onFirstPick, centerLabel = '선픽 고르기', highlightSide, mapName }: {
  series: Series; blueWins: number; redWins: number; firstPick: Team; onFirstPick: (t: Team) => void;
  centerLabel?: string; // 셋업="선픽 고르기", 드래프트=현재 밴/픽 차례
  highlightSide?: Team; // 그라데이션·삼각형 강조 사이드. 없으면 선픽. 드래프트=현재 차례 팀.
  mapName?: string; // 있으면 Bo·세트 자리에 맵 이름 표시(드래프트 중).
}) {
  const setNo = series.sets.length + 1;
  const side = highlightSide ?? firstPick; // 강조 사이드(그라데이션·삼각형)
  const grad = side === 'blue'
    ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor('blue')} 22%, var(--surface-card)), var(--surface-card) 55%)`
    : `linear-gradient(270deg, color-mix(in srgb, ${teamColor('red')} 22%, var(--surface-card)), var(--surface-card) 55%)`;
  return (
    <div style={{ ...card, background: grad, display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', padding: 'var(--sp-3) var(--sp-5)' }}>
      {/* A팀(블루) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', justifySelf: 'start' }}>
        <ScoreBoxes team="blue" wins={blueWins} total={Math.ceil(series.bestOf / 2)} />
        <span style={{ color: teamColor('blue'), fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)' }}>
          {teamLabel(series, 'blue')} 팀
        </span>
      </div>

      {/* 중앙: 삼각형(상하 꽉) + 선픽 고르기 */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--sp-3)', minHeight: 48 }}>
        <TriPick dir="left" active={side === 'blue'} color={teamColor('blue')} onClick={() => onFirstPick('blue')} />
        <div style={{ display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--text-high)' }}>
            {mapName ?? `Bo${series.bestOf} · ${setNo}세트`}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)', color: 'var(--text-high)' }}>{centerLabel}</span>
        </div>
        <TriPick dir="right" active={side === 'red'} color={teamColor('red')} onClick={() => onFirstPick('red')} />
      </div>

      {/* B팀(레드) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', justifySelf: 'end' }}>
        <span style={{ color: teamColor('red'), fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)' }}>
          {teamLabel(series, 'red')} 팀
        </span>
        <ScoreBoxes team="red" wins={redWins} total={Math.ceil(series.bestOf / 2)} />
      </div>
    </div>
  );
}

// 선픽 선택 삼각형 — 바 높이를 상하로 꽉 채움. 활성 시 팀색, 아니면 흐림.
function TriPick({ dir, active, color, onClick }: { dir: 'left' | 'right'; active: boolean; color: string; onClick: () => void }) {
  const c = active ? color : 'var(--text-faint)';
  return (
    <button onClick={onClick} aria-label={dir === 'left' ? '블루 선픽' : '레드 선픽'}
      style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', background: 'none', border: 'none',
        cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 0, height: 0,
        borderTop: '24px solid transparent', borderBottom: '24px solid transparent',
        ...(dir === 'left' ? { borderRight: `32px solid ${c}` } : { borderLeft: `32px solid ${c}` }) }} />
    </button>
  );
}

// 승수 표기 박스 — total칸(Bo수), 이긴 만큼 팀색 채움.
function ScoreBoxes({ team, wins, total }: { team: Team; wins: number; total: number }) {
  const c = teamColor(team);
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: 11, height: 17, borderRadius: 2,
          border: `1px solid ${c}`, background: i < wins ? c : 'transparent' }} />
      ))}
    </div>
  );
}

// 세로 맵 카드 6개/페이지 + 페이지 넘김 화살표.
function MapPager({ maps, map, onPick, page, onPage }: {
  maps: string[]; map: string; onPick: (m: string) => void; page: number; onPage: (p: number) => void;
}) {
  const perPage = 6;
  const pageCount = Math.max(1, Math.ceil(maps.length / perPage));
  const cur = Math.min(page, pageCount - 1);
  const shown = maps.slice(cur * perPage, cur * perPage + perPage);
  const arrow = (dir: 'prev' | 'next', disabled: boolean) => (
    <button onClick={() => onPage(dir === 'next' ? cur + 1 : cur - 1)} disabled={disabled}
      aria-label={dir === 'next' ? '다음 맵' : '이전 맵'}
      style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, border: '1px solid var(--border-line)',
        background: 'var(--surface-input)', color: 'var(--text-body)', fontSize: 22, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1 }}>{dir === 'next' ? '›' : '‹'}</button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
      {arrow('prev', cur === 0)}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0 }}>
        {shown.map((m) => {
          const img = mapImageUrl(m);
          const isSel = m === map;
          return (
            <button key={m} onClick={() => onPick(m)} title={m}
              style={{ position: 'relative', padding: 0, aspectRatio: '2 / 4', borderRadius: 0,
                overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-strong)',
                outline: isSel ? selectedOutline : 'none', outlineOffset: -2, zIndex: isSel ? 1 : 0,
                transition: 'outline-color var(--dur-fast) var(--ease-out)' }}>
              {img && <Image src={img} alt={m} fill sizes="400px" quality={90}
                style={{ objectFit: 'cover', filter: map && !isSel ? 'saturate(0.75) brightness(0.7)' : 'none',
                  transition: 'filter var(--dur-fast) var(--ease-out)' }} />}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 8px 6px', textAlign: 'center',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>{m}</span>
              {isSel && <span style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 999,
                background: 'var(--cheese-green)', color: 'var(--text-on-green)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>✓</span>}
            </button>
          );
        })}
      </div>
      {arrow('next', cur >= pageCount - 1)}
    </div>
  );
}
