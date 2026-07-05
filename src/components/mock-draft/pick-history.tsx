'use client';

import type { Series, Player } from '@/lib/draft/types';

// 플레이어별 세트 순서대로 픽한 영웅 목록.
function historyFor(series: Series, playerId: string): string[] {
  const heroes: string[] = [];
  for (const set of series.sets) {
    for (const team of ['blue', 'red'] as const) {
      for (const [pid, hero] of set.picks[team]) {
        if (pid === playerId) heroes.push(hero);
      }
    }
  }
  return heroes;
}

function TeamHistory({ title, players, series }: { title: string; players: Player[]; series: Series }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      {players.map((p) => (
        <div key={p.id} style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>{p.name}</span>: {historyFor(series, p.id).join(', ') || '—'}
        </div>
      ))}
    </div>
  );
}

export function PickHistory({ series }: { series: Series }) {
  if (series.sets.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '1px solid #8884', borderRadius: 8, padding: 8 }}>
      <TeamHistory title="블루 픽 이력" players={series.blue} series={series} />
      <TeamHistory title="레드 픽 이력" players={series.red} series={series} />
    </div>
  );
}
