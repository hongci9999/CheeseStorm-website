'use client';

import Image from 'next/image';
import { mapImageUrl } from '@/lib/draft/map-image';
import { heroImageUrl } from '@/lib/hero-image';
import { HexAvatar } from '@/components/hexagon-avatar';
import type { Series, Team } from '@/lib/draft/types';
import { card, teamColor, teamLabel } from './ui';

// 시리즈 종료 시 — 승리 문구 + 이긴 팀 스트리머 카드 + 세트별 밴/픽 기록.
export function SeriesSummary({ series, winner }: { series: Series; winner: Team }) {
  const accent = teamColor(winner);
  const winners = winner === 'blue' ? series.blue : series.red;
  const nameOf = (id: string) =>
    [...series.blue, ...series.red].find((p) => p.id === id)?.name ?? id;

  return (
    <section style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      {/* 승리 문구 + 이긴 팀 스트리머 카드 */}
      <div style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center', padding: 'var(--sp-4) 0' }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-2xl)', color: accent }}>
           {teamLabel(series, winner)} 팀 승리
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {winners.map((p, i) => (
            <div key={p.id} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative' }}>
                <HexAvatar name={p.name} imageUrl={p.imageUrl} ring={accent} size={104} />
                {i === 0 && (
                  <span title="팀장" style={{ position: 'absolute', top: -2, right: 6, zIndex: 3,
                    width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center',
                    background: accent, color: 'var(--bg-void)', fontSize: 15, lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>👑</span>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-high)',
                maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 세트별 밴/픽 기록 */}
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
              const tc = teamColor(team);
              return (
                <div key={team} style={{ display: 'grid', gap: 6 }}>
                  <strong style={{ color: tc, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-sm)', letterSpacing: 'var(--ls-wide)' }}>
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
                          {img && <Image key={j} src={img} alt={hero} width={22} height={22}
                            style={{ borderRadius: 'var(--r-xs)', width: 22, height: 'auto', boxShadow: `0 0 0 1px color-mix(in srgb, ${tc} 40%, transparent)` }} />}
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
