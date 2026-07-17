'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import { HOTS_MAPS } from '@/lib/draft/maps';
import { mapImageUrl } from '@/lib/draft/map-image';
import { field, selectedOutline } from '@/components/mock-draft/ui';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import {
  heroScrimStats, mapScrimStats, firstPickSummary,
  synergyPairs, counterPairs, distinctPatches, MIN_PAIR_GAMES,
  firstPickHeroStats, openBanHeroStats,
} from '@/lib/scrim-stats';
import type { Scrim } from '@/lib/scrim';

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const rateColor = (v: number) => (v >= 0.5 ? 'var(--win)' : 'var(--loss)');

// 대시보드에서 보여줄 영웅 메타 상위 행 수 — 전체는 /scrims/heroes
const HERO_TOP_N = 8;

// ── 공통 스타일 (영웅 메타 상세 페이지에서도 재사용) ──────────
export const sectionCard: CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-line)',
  borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--sp-4)',
  display: 'grid', gap: 'var(--sp-3)', alignContent: 'start',
};
export const sectionTitle: CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)',
  color: 'var(--text-high)',
};
export const sectionHint: CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)',
};
export const th: CSSProperties = {
  textAlign: 'right', padding: '6px 8px', whiteSpace: 'nowrap',
  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
  color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)',
  borderBottom: '1px solid var(--border-line)',
};
export const td: CSSProperties = {
  textAlign: 'right', padding: '5px 8px', whiteSpace: 'nowrap',
  fontFamily: 'var(--font-numeral)', fontSize: 'var(--fs-xs)', color: 'var(--text-body)',
};
export const tdLeft: CSSProperties = { ...td, textAlign: 'left', fontFamily: 'var(--font-ui)' };

export function HeroCell({ hero }: { hero: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <HexAvatar name={hero} imageUrl={heroImageUrl(hero)} ring="var(--border-strong)" size={24} />
      <span style={{ fontWeight: 600, color: 'var(--text-high)' }}>{hero}</span>
    </span>
  );
}

const chipStyle = (active: boolean): CSSProperties => ({
  height: 'var(--control-sm)', padding: '0 var(--sp-3)', borderRadius: 'var(--r-pill)',
  border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
  background: active ? 'color-mix(in srgb, var(--cheese-green) 14%, transparent)' : 'transparent',
  color: active ? 'var(--text-high)' : 'var(--text-muted)',
  fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500, fontSize: 'var(--fs-xs)',
  cursor: 'pointer',
});

// 패치(셀렉트) + 맵(이미지 드롭다운) 필터 — 대시보드·영웅 상세 공용.
// 맵 패널은 경기기록의 맵 선택 그리드와 같은 이미지 타일, 5열 × 3행 고정.
export function ScrimFilters({ patches, recordedMaps, patch, map, onPatchChange, onMapChange }: {
  patches: string[]; recordedMaps: string[];
  patch: string; map: string;
  onPatchChange: (v: string) => void; onMapChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const recorded = new Set(recordedMaps);

  const pick = (m: string) => { onMapChange(m); setOpen(false); };

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
      {patches.length > 0 && (
        <label style={{ ...sectionHint, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          패치
          <select value={patch} onChange={(e) => onPatchChange(e.target.value)} style={{ ...field, height: 'var(--control-sm)' }}>
            <option value="">전체</option>
            {patches.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      )}

      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={sectionHint}>맵</span>
        <button onClick={() => setOpen((v) => !v)}
          style={{ ...field, height: 'var(--control-sm)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: map ? 700 : 500 }}>{map || '전체'}</span>
          <span style={{ ...sectionHint, fontSize: 10 }}>▾</span>
        </button>

        {open && (
          <>
            {/* 바깥 클릭 닫기용 투명 배경 */}
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
              width: 'min(720px, 92vw)', padding: 'var(--sp-3)',
              background: 'var(--surface-card)', border: '1px solid var(--border-line)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
              display: 'grid', gap: 'var(--sp-2)' }}>
              <button onClick={() => pick('')} style={chipStyle(map === '')}>전체</button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {HOTS_MAPS.map((m) => {
                  const img = mapImageUrl(m);
                  const isSel = m === map;
                  const has = recorded.has(m);
                  return (
                    <button key={m} onClick={() => has && pick(m)} title={has ? m : `${m} — 기록 없음`}
                      disabled={!has}
                      style={{ position: 'relative', height: 56, padding: 0, overflow: 'hidden',
                        borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
                        cursor: has ? 'pointer' : 'default',
                        outline: isSel ? selectedOutline : 'none', outlineOffset: -2 }}>
                      {img && <Image src={img} alt={m} fill sizes="160px"
                        style={{ objectFit: 'cover',
                          filter: !has ? 'saturate(0.2) brightness(0.35)'
                            : map && !isSel ? 'saturate(0.7) brightness(0.55)' : 'brightness(0.8)' }} />}
                      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                        padding: '0 4px', textAlign: 'center',
                        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        color: has ? '#fff' : 'rgba(255,255,255,0.45)',
                        textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p style={{ ...sectionHint, padding: 'var(--sp-2) 0' }}>{children}</p>;
}

// ── 대시보드 ─────────────────────────────────────────────────
export default function ScrimDashboard({ scrims }: { scrims: Scrim[] }) {
  const bp = useBreakpoint();
  const [patch, setPatch] = useState<string>(''); // '' = 전체
  const [map, setMap] = useState<string>('');     // '' = 전체
  const patches = useMemo(() => distinctPatches(scrims), [scrims]);
  const allMaps = useMemo(() => mapScrimStats(scrims).map((m) => m.map), [scrims]);
  const filtered = useMemo(
    () => scrims.filter((s) => (!patch || s.patch === patch) && (!map || s.map === map)),
    [scrims, patch, map],
  );

  const heroes = useMemo(() => heroScrimStats(filtered), [filtered]);
  const fp = useMemo(() => firstPickSummary(filtered), [filtered]);
  // 승률 50% 초과 조합만 노출 — 50% 이하는 시너지/카운터라 부르기 애매
  const synergy = useMemo(() => synergyPairs(filtered).filter((p) => p.winRate > 0.5), [filtered]);
  const counters = useMemo(() => counterPairs(filtered).filter((p) => p.winRate > 0.5), [filtered]);
  const firstPicks = useMemo(() => firstPickHeroStats(filtered), [filtered]);
  const openBans = useMemo(() => openBanHeroStats(filtered), [filtered]);

  if (scrims.length === 0) {
    return <EmptyHint>기록된 스크림이 없습니다. 밴픽 탭에서 경기를 기록하면 통계가 쌓입니다.</EmptyHint>;
  }

  // 데스크톱 배치: 1행 = 영웅 / 오프닝 밴 / 1픽, 2행 = 조합·대응 카드 5개 한 줄(내부 세로 스크롤)
  const desktop = bp === 'desktop';
  const bentoGrid: CSSProperties = desktop
    ? {
        display: 'grid', gap: 'var(--sp-4)', alignItems: 'start',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
        gridTemplateAreas: `"hero openban firstpick"`,
      }
    : { display: 'grid', gap: 'var(--sp-4)' };
  const area = (name: string): CSSProperties => (desktop ? { gridArea: name } : {});
  // 조합 카드: 시너지·카운터 반반
  const pairRow: CSSProperties = desktop
    ? {
        display: 'grid', gap: 'var(--sp-4)', alignItems: 'start',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateAreas: `"synergy counters"`,
      }
    : { display: 'grid', gap: 'var(--sp-4)' };
  // 목록이 길어지면 카드 안에서 세로 스크롤
  const scrollBox: CSSProperties = { maxHeight: 340, overflowY: 'auto' };

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {/* 필터: 패치 · 맵 */}
      <ScrimFilters patches={patches} recordedMaps={allMaps}
        patch={patch} map={map} onPatchChange={setPatch} onMapChange={setMap} />

      {/* 핵심 수치 — 박스 없이 인라인 강조 */}
      <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        {([['경기 수', fp.games], ['등장 영웅', heroes.length]] as const).map(([label, value]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            <span style={sectionHint}>{label}</span>
            <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800,
              fontSize: 'var(--fs-xl)', color: 'var(--text-high)', lineHeight: 1 }}>{value}</span>
          </span>
        ))}
      </div>

      <div style={bentoGrid}>
        {/* 영웅 메타 — 상위 N개만, 상세는 별도 페이지 */}
        <section style={{ ...sectionCard, ...area('hero') }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
            <h2 style={sectionTitle}>영웅 메타 TOP {HERO_TOP_N}</h2>
            <span style={sectionHint}>관여율 = (밴+픽)/경기</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>영웅</th>
                  <th style={th}>관여율</th>
                  <th style={th}>밴</th>
                  <th style={th}>픽</th>
                  <th style={th}>픽 승률</th>
                </tr>
              </thead>
              <tbody>
                {heroes.slice(0, HERO_TOP_N).map((h) => (
                  <tr key={h.hero} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-line) 55%, transparent)' }}>
                    <td style={tdLeft}><HeroCell hero={h.hero} /></td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-high)' }}>{pct(h.presenceRate)}</td>
                    <td style={td}>{h.bans}</td>
                    <td style={td}>{h.picks}</td>
                    <td style={{ ...td, color: h.picks ? rateColor(h.pickWinRate) : 'var(--text-faint)' }}>
                      {h.picks ? `${pct(h.pickWinRate)} (${h.pickWins}/${h.picks})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/scrims/heroes" style={{
            justifySelf: 'end', fontFamily: 'var(--font-ui)', fontWeight: 700,
            fontSize: 'var(--fs-xs)', color: 'var(--cheese-green)', textDecoration: 'none' }}>
            전체 {heroes.length}개 영웅 상세 →
          </Link>
        </section>

        {/* 1픽 영웅 */}
        <section style={{ ...sectionCard, ...area('firstpick') }}>
          <h2 style={sectionTitle}>1픽 영웅</h2>
          <span style={sectionHint}>밴 4장 이후에도 살아남아 첫 픽으로 잡힌 영웅</span>
          {firstPicks.length === 0 ? (
            <EmptyHint>기록이 없습니다.</EmptyHint>
          ) : (
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>영웅</th><th style={th}>횟수</th><th style={th}>승률</th>
              </tr></thead>
              <tbody>
                {firstPicks.slice(0, 6).map((f) => (
                  <tr key={f.hero}>
                    <td style={tdLeft}><HeroCell hero={f.hero} /></td>
                    <td style={td}>{f.picks}</td>
                    <td style={{ ...td, color: rateColor(f.winRate) }}>{pct(f.winRate)} ({f.wins}/{f.picks})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 오프닝 밴 */}
        <section style={{ ...sectionCard, ...area('openban') }}>
          <h2 style={sectionTitle}>오프닝 밴</h2>
          <span style={sectionHint}>전역 밴 1~4 · 밴 비율 = 오프닝 밴 경기/전체 · 선/후 = 자른 팀</span>
          {openBans.length === 0 ? (
            <EmptyHint>기록이 없습니다.</EmptyHint>
          ) : (
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>영웅</th>
                <th style={th}>횟수</th><th style={th}>밴 비율</th><th style={th}>선/후</th>
              </tr></thead>
              <tbody>
                {openBans.slice(0, 8).map((b) => (
                  <tr key={b.hero}>
                    <td style={tdLeft}><HeroCell hero={b.hero} /></td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-high)' }}>{b.bans}</td>
                    <td style={td}>{fp.games ? pct(b.bans / fp.games) : '—'}</td>
                    <td style={td}>{b.byFirstPick} / {b.bans - b.byFirstPick}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* 조합 카드 — 시너지·카운터 한 행, 길면 카드 내부 스크롤 */}
      <div style={pairRow}>
        {/* 시너지 */}
        <section style={{ ...sectionCard, ...area('synergy') }}>
          <h2 style={sectionTitle}>시너지 조합</h2>
          <span style={sectionHint}>같은 팀 2영웅 · {MIN_PAIR_GAMES}경기 이상 · 승률 50% 초과만</span>
          {synergy.length === 0 ? (
            <EmptyHint>표본 {MIN_PAIR_GAMES}경기 이상에 승률 50%를 넘는 조합이 아직 없습니다.</EmptyHint>
          ) : (
            <div style={scrollBox}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {synergy.map((p) => (
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
            </div>
          )}
        </section>

        {/* 카운터 */}
        <section style={{ ...sectionCard, ...area('counters') }}>
          <h2 style={sectionTitle}>카운터 관계</h2>
          <span style={sectionHint}>상대로 만났을 때 · {MIN_PAIR_GAMES}경기 이상 · 승률 50% 초과만 · 왼쪽이 우세</span>
          {counters.length === 0 ? (
            <EmptyHint>표본 {MIN_PAIR_GAMES}경기 이상에 승률 50%를 넘는 조합이 아직 없습니다.</EmptyHint>
          ) : (
            <div style={scrollBox}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {counters.map((p) => (
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
