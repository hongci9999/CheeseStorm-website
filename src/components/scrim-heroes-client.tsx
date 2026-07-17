'use client';

// 영웅 메타 상세 — 대시보드 축약 테이블의 전체 버전 (모든 컬럼·모든 영웅)
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  pct, rateColor, sectionCard, sectionTitle, sectionHint, th, td, tdLeft,
  HeroCell, ScrimFilters,
} from '@/components/scrim-dashboard';
import { heroScrimStats, mapScrimStats, firstPickSummary, distinctPatches } from '@/lib/scrim-stats';
import type { Scrim } from '@/lib/scrim';

export default function ScrimHeroesClient({ scrims }: { scrims: Scrim[] }) {
  const [patch, setPatch] = useState<string>('');
  const [map, setMap] = useState<string>('');
  const patches = useMemo(() => distinctPatches(scrims), [scrims]);
  const allMaps = useMemo(() => mapScrimStats(scrims).map((m) => m.map), [scrims]);
  const filtered = useMemo(
    () => scrims.filter((s) => (!patch || s.patch === patch) && (!map || s.map === map)),
    [scrims, patch, map],
  );
  const heroes = useMemo(() => heroScrimStats(filtered), [filtered]);
  const games = firstPickSummary(filtered).games;

  return (
    <main style={{ padding: 'var(--sp-5)', display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-xl)', color: 'var(--text-high)', letterSpacing: 'var(--ls-tight)' }}>
          영웅 메타 상세
        </h1>
        <Link href="/scrims" style={{ ...sectionHint, textDecoration: 'none' }}>← 스크림 대시보드</Link>
      </div>

      <ScrimFilters patches={patches} recordedMaps={allMaps}
        patch={patch} map={map} onPatchChange={setPatch} onMapChange={setMap} />

      <section style={sectionCard}>
        <div>
          <h2 style={sectionTitle}>영웅 메타 · {games}경기</h2>
          <span style={sectionHint}>관여율 = (밴+픽)/경기 · 열리면 픽률 = 밴 안 된 경기 중 픽 비율 · 픽순번 = 전역 1~10 평균</span>
        </div>
        {heroes.length === 0 ? (
          <p style={{ ...sectionHint, padding: 'var(--sp-2) 0' }}>조건에 맞는 기록이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>영웅</th>
                  <th style={th}>관여율</th>
                  <th style={th}>밴</th>
                  <th style={th}>오프닝/미드</th>
                  <th style={th}>픽</th>
                  <th style={th}>픽 승률</th>
                  <th style={th}>픽순번</th>
                  <th style={th}>열리면 픽률</th>
                </tr>
              </thead>
              <tbody>
                {heroes.map((h) => (
                  <tr key={h.hero} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-line) 55%, transparent)' }}>
                    <td style={tdLeft}><HeroCell hero={h.hero} /></td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-high)' }}>{pct(h.presenceRate)}</td>
                    <td style={td}>{h.bans}</td>
                    <td style={td}>{h.openBans} / {h.midBans}</td>
                    <td style={td}>{h.picks}</td>
                    <td style={{ ...td, color: h.picks ? rateColor(h.pickWinRate) : 'var(--text-faint)' }}>
                      {h.picks ? `${pct(h.pickWinRate)} (${h.pickWins}/${h.picks})` : '—'}
                    </td>
                    <td style={td}>{h.avgPickOrder !== null ? h.avgPickOrder.toFixed(1) : '—'}</td>
                    <td style={td}>{h.bans < games ? pct(h.openPickRate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
