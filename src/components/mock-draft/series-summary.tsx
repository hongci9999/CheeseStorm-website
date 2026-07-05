'use client';

import type { Series, Team } from '@/lib/draft/types';

// 시리즈 종료 시 각 세트의 전체 밴/픽 기록을 표시.
export function SeriesSummary({ series, winner }: { series: Series; winner: Team }) {
  const nameOf = (id: string) =>
    [...series.blue, ...series.red].find((p) => p.id === id)?.name ?? id;

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>
        🏆 {winner === 'blue' ? '블루' : '레드'} 시리즈 승리 — 종료
      </div>

      {series.sets.map((set, i) => (
        <div key={i} style={{ border: '1px solid #8884', borderRadius: 8, padding: 10, display: 'grid', gap: 6 }}>
          <div style={{ fontWeight: 700 }}>
            세트 {i + 1} · {set.map} ·{' '}
            <span style={{ color: set.winner === 'blue' ? '#3b82f6' : '#ef4444' }}>
              {set.winner === 'blue' ? '블루' : '레드'} 승
            </span>
            <span style={{ opacity: 0.6, fontWeight: 400 }}> (선픽 {set.firstPick === 'blue' ? '블루' : '레드'})</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['blue', 'red'] as const).map((team) => (
              <div key={team} style={{ display: 'grid', gap: 4 }}>
                <strong style={{ color: team === 'blue' ? '#3b82f6' : '#ef4444', fontSize: 13 }}>
                  {team === 'blue' ? '블루' : '레드'}
                </strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  밴: {set.bans[team].join(', ') || '—'}
                </div>
                <div style={{ display: 'grid', gap: 2 }}>
                  {set.picks[team].map(([pid, hero], j) => (
                    <div key={j} style={{ fontSize: 13 }}>{nameOf(pid)} — {hero}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
