'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { HexAvatar } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import {
  heroScrimStats, mapScrimStats, firstPickSummary,
  synergyPairs, counterPairs, roleCompStats, distinctPatches, MIN_PAIR_GAMES,
} from '@/lib/scrim-stats';
import type { Scrim } from '@/lib/scrim';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const rateColor = (v: number) => (v >= 0.5 ? 'var(--win)' : 'var(--loss)');

// ── 공통 스타일 ──────────────────────────────────────────────
const sectionCard: CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-line)',
  borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--sp-4)',
  display: 'grid', gap: 'var(--sp-3)', alignContent: 'start',
};
const sectionTitle: CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)',
  color: 'var(--text-high)',
};
const sectionHint: CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)',
};
const th: CSSProperties = {
  textAlign: 'right', padding: '6px 8px', whiteSpace: 'nowrap',
  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
  color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)',
  borderBottom: '1px solid var(--border-line)',
};
const td: CSSProperties = {
  textAlign: 'right', padding: '5px 8px', whiteSpace: 'nowrap',
  fontFamily: 'var(--font-numeral)', fontSize: 'var(--fs-xs)', color: 'var(--text-body)',
};
const tdLeft: CSSProperties = { ...td, textAlign: 'left', fontFamily: 'var(--font-ui)' };

function HeroCell({ hero }: { hero: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <HexAvatar name={hero} imageUrl={heroImageUrl(hero)} ring="var(--border-strong)" size={24} />
      <span style={{ fontWeight: 600, color: 'var(--text-high)' }}>{hero}</span>
    </span>
  );
}

function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div style={{ ...sectionCard, padding: 'var(--sp-3) var(--sp-4)', gap: 2 }}>
      <span style={sectionHint}>{label}</span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 'var(--fs-xl)',
        color: 'var(--text-high)', lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={sectionHint}>{sub}</span>}
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p style={{ ...sectionHint, padding: 'var(--sp-2) 0' }}>{children}</p>;
}

// ── 대시보드 ─────────────────────────────────────────────────
export default function ScrimDashboard({ scrims }: { scrims: Scrim[] }) {
  const [patch, setPatch] = useState<string>(''); // '' = 전체
  const patches = useMemo(() => distinctPatches(scrims), [scrims]);
  const filtered = useMemo(
    () => (patch ? scrims.filter((s) => s.patch === patch) : scrims),
    [scrims, patch],
  );

  const heroes = useMemo(() => heroScrimStats(filtered), [filtered]);
  const maps = useMemo(() => mapScrimStats(filtered), [filtered]);
  const fp = useMemo(() => firstPickSummary(filtered), [filtered]);
  const synergy = useMemo(() => synergyPairs(filtered), [filtered]);
  const counters = useMemo(() => counterPairs(filtered), [filtered]);
  const comps = useMemo(() => roleCompStats(filtered), [filtered]);

  if (scrims.length === 0) {
    return <EmptyHint>기록된 스크림이 없습니다. 밴픽 탭에서 경기를 기록하면 통계가 쌓입니다.</EmptyHint>;
  }

  const chip = (active: boolean): CSSProperties => ({
    height: 'var(--control-sm)', padding: '0 var(--sp-3)', borderRadius: 'var(--r-pill)',
    border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
    background: active ? 'color-mix(in srgb, var(--cheese-green) 14%, transparent)' : 'transparent',
    color: active ? 'var(--text-high)' : 'var(--text-muted)',
    fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500, fontSize: 'var(--fs-xs)',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {/* 패치 필터 */}
      {patches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={sectionHint}>패치</span>
          <button onClick={() => setPatch('')} style={chip(patch === '')}>전체</button>
          {patches.map((p) => (
            <button key={p} onClick={() => setPatch(p)} style={chip(patch === p)}>{p}</button>
          ))}
        </div>
      )}

      {/* 요약 타일 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-3)' }}>
        <StatTile label="경기 수" value={fp.games} />
        <StatTile label="선픽팀 승률" value={<span style={{ color: rateColor(fp.firstPickWinRate) }}>{pct(fp.firstPickWinRate)}</span>}
          sub={`${fp.firstPickWins}승 ${fp.games - fp.firstPickWins}패`} />
        <StatTile label="플레이한 맵" value={maps.length} />
        <StatTile label="등장 영웅" value={heroes.length} sub="밴 또는 픽 관여" />
      </div>

      {/* 영웅 메타 테이블 — 전체 폭 */}
      <section style={sectionCard}>
        <div>
          <h2 style={sectionTitle}>영웅 메타</h2>
          <span style={sectionHint}>관여율 = (밴+픽)/경기 · 열리면 픽률 = 밴 안 된 경기 중 픽 비율 · 픽순번 = 전역 1~10 평균</span>
        </div>
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
                  <td style={td}>{h.bans < fp.games ? pct(h.openPickRate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 하위 섹션 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-4)', alignItems: 'start' }}>
        {/* 맵별 */}
        <section style={sectionCard}>
          <h2 style={sectionTitle}>맵별 선픽팀 승률</h2>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>맵</th><th style={th}>경기</th><th style={th}>선픽 승률</th>
            </tr></thead>
            <tbody>
              {maps.map((m) => (
                <tr key={m.map}>
                  <td style={tdLeft}>{m.map}</td>
                  <td style={td}>{m.games}</td>
                  <td style={{ ...td, color: rateColor(m.firstPickWinRate) }}>
                    {pct(m.firstPickWinRate)} ({m.firstPickWins}/{m.games})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 역할군 조합 */}
        <section style={sectionCard}>
          <h2 style={sectionTitle}>역할군 조합</h2>
          <span style={sectionHint}>팀 단위 표본 (경기당 2팀)</span>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>조합</th><th style={th}>표본</th><th style={th}>승률</th>
            </tr></thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.comp}>
                  <td style={tdLeft}>{c.comp}</td>
                  <td style={td}>{c.games}</td>
                  <td style={{ ...td, color: rateColor(c.winRate) }}>{pct(c.winRate)} ({c.wins}/{c.games})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 시너지 */}
        <section style={sectionCard}>
          <h2 style={sectionTitle}>시너지 조합</h2>
          <span style={sectionHint}>같은 팀 2영웅 · {MIN_PAIR_GAMES}경기 이상</span>
          {synergy.length === 0 ? (
            <EmptyHint>표본 {MIN_PAIR_GAMES}경기 이상인 조합이 아직 없습니다.</EmptyHint>
          ) : (
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {synergy.slice(0, 10).map((p) => (
                  <tr key={`${p.a}|${p.b}`}>
                    <td style={tdLeft}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <HeroCell hero={p.a} /><span style={sectionHint}>+</span><HeroCell hero={p.b} />
                      </span>
                    </td>
                    <td style={{ ...td, color: rateColor(p.winRate) }}>{pct(p.winRate)} ({p.wins}/{p.games})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 카운터 */}
        <section style={sectionCard}>
          <h2 style={sectionTitle}>카운터 관계</h2>
          <span style={sectionHint}>상대로 만났을 때 · {MIN_PAIR_GAMES}경기 이상 · 왼쪽이 우세</span>
          {counters.length === 0 ? (
            <EmptyHint>표본 {MIN_PAIR_GAMES}경기 이상인 조합이 아직 없습니다.</EmptyHint>
          ) : (
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {counters.slice(0, 10).map((p) => (
                  <tr key={`${p.a}|${p.b}`}>
                    <td style={tdLeft}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <HeroCell hero={p.a} /><span style={sectionHint}>vs</span><HeroCell hero={p.b} />
                      </span>
                    </td>
                    <td style={{ ...td, color: rateColor(p.winRate) }}>{pct(p.winRate)} ({p.wins}/{p.games})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
