'use client';

// 영웅 메타 상세 — 대시보드 축약 테이블의 전체 버전 (모든 컬럼·모든 영웅)
import { useMemo } from 'react';
import Link from 'next/link';
import {
  pct, rateColor, sectionCard, sectionTitle, sectionHint, th, td, tdLeft,
  HeroCell, ScrimFilters, useScrimFilters,
} from '@/components/scrim-dashboard';
import { heroScrimStats, firstPickSummary } from '@/lib/scrim-stats';
import type { Scrim } from '@/lib/scrim';

export default function ScrimHeroesClient({ scrims }: { scrims: Scrim[] }) {
  const f = useScrimFilters(scrims);
  const { filtered, locks } = f;
  const heroes = useMemo(() => heroScrimStats(filtered, locks), [filtered, locks]);
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

      <ScrimFilters patches={f.patches} recordedMaps={f.allMaps}
        patch={f.patch} map={f.map} game={f.game}
        onPatchChange={f.setPatch} onMapChange={f.setMap} onGameChange={f.setGame} />

      <section style={sectionCard}>
        <div>
          <h2 style={sectionTitle}>영웅 메타 · {games}경기</h2>
          <span style={sectionHint}>
            가용 = 하드 피어리스로 잠기지 않은 경기 수(모든 비율의 분모) ·
            관여율 = (밴+픽)/가용 · 열리면 픽률 = 가용 경기 중 밴도 안 된 경기에서 픽된 비율 ·
            픽순번 = 전역 1~10 평균
          </span>
        </div>
        {heroes.length === 0 ? (
          <p style={{ ...sectionHint, padding: 'var(--sp-2) 0' }}>조건에 맞는 기록이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>영웅</th>
                  <th style={th}>가용</th>
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
                    <td style={{ ...td, color: h.availableGames < games ? 'var(--text-high)' : 'var(--text-faint)' }}>
                      {h.availableGames}/{games}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-high)' }}>{pct(h.presenceRate)}</td>
                    <td style={td}>{h.bans}</td>
                    <td style={td}>{h.openBans} / {h.midBans}</td>
                    <td style={td}>{h.picks}</td>
                    <td style={{ ...td, color: h.picks ? rateColor(h.pickWinRate) : 'var(--text-faint)' }}>
                      {h.picks ? `${pct(h.pickWinRate)} (${h.pickWins}/${h.picks})` : '—'}
                    </td>
                    <td style={td}>{h.avgPickOrder !== null ? h.avgPickOrder.toFixed(1) : '—'}</td>
                    <td style={td}>{h.bans < h.availableGames ? pct(h.openPickRate) : '—'}</td>
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
