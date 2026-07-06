'use client';

import Image from 'next/image';
import { mapImageUrl } from '@/lib/draft/map-image';
import { heroImageUrl } from '@/lib/hero-image';
import type { Series, Team } from '@/lib/draft/types';
import { card, teamColor, teamLabel } from './ui';

// 시리즈 종료 시 각 세트의 전체 밴/픽 기록을 표시.
export function SeriesSummary({ series, winner }: { series: Series; winner: Team }) {
  const nameOf = (id: string) =>
    [...series.blue, ...series.red].find((p) => p.id === id)?.name ?? id;

  return (
    <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-xl)',
        color: teamColor(winner) }}>
        🏆 {teamLabel(series, winner)} 시리즈 승리 — 종료
      </div>

      {series.sets.map((set, i) => (
        <div key={i} style={{ ...card, display: 'grid', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            {mapImageUrl(set.map) && (
              <Image src={mapImageUrl(set.map)!} alt={set.map} width={56} height={32}
                style={{ borderRadius: 'var(--r-sm)', objectFit: 'cover', width: 56, height: 'auto' }} />
            )}
            <span style={{ color: 'var(--text-high)', fontSize: 'var(--fs-md)' }}>
              세트 {i + 1} · {set.map} ·{' '}
              <span style={{ color: teamColor(set.winner) }}>
                {teamLabel(series, set.winner)} 승
              </span>
              <span style={{ color: 'var(--text-faint)', fontWeight: 500, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)' }}> (선픽 {teamLabel(series, set.firstPick)})</span>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            {(['blue', 'red'] as const).map((team) => {
              const accent = teamColor(team);
              return (
                <div key={team} style={{ display: 'grid', gap: 6 }}>
                  <strong style={{ color: accent, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-sm)', letterSpacing: 'var(--ls-wide)' }}>
                    {teamLabel(series, team)}
                  </strong>

                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>밴</span>
                    {set.bans[team].length === 0 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>—</span>}
                    {set.bans[team].map((hero, k) => {
                      const img = heroImageUrl(hero);
                      return img
                        ? <Image key={k} src={img} alt={hero} title={hero} width={20} height={20}
                            style={{ borderRadius: 'var(--r-xs)', width: 20, height: 'auto', filter: 'grayscale(1)', opacity: 0.55 }} />
                        : <span key={k} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{hero}</span>;
                    })}
                  </div>

                  <div style={{ display: 'grid', gap: 3 }}>
                    {set.picks[team].map(([pid, hero], j) => {
                      const img = heroImageUrl(hero);
                      return (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {img && <Image src={img} alt={hero} width={22} height={22}
                            style={{ borderRadius: 'var(--r-xs)', width: 22, height: 'auto', boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)` }} />}
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-body)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{nameOf(pid)}</span> · {hero}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
