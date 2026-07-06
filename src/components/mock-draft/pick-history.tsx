'use client';

import type { Series, Player, Team } from '@/lib/draft/types';
import { card, teamColor, teamLabel } from './ui';

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

function TeamHistory({ title, team, players, series }: { title: string; team: Team; players: Player[]; series: Series }) {
  const accent = teamColor(team);
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      <strong style={{ color: accent, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-sm)', letterSpacing: 'var(--ls-wide)' }}>{title}</strong>
      {players.map((p) => (
        <div key={p.id} style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-body)' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-high)' }}>{p.name}</span>
          <span style={{ color: 'var(--text-faint)' }}>: </span>
          {historyFor(series, p.id).join(', ') || '—'}
        </div>
      ))}
    </div>
  );
}

export function PickHistory({ series }: { series: Series }) {
  if (series.sets.length === 0) return null;
  return (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
      <TeamHistory title={`${teamLabel(series, 'blue')} 픽 이력`} team="blue" players={series.blue} series={series} />
      <TeamHistory title={`${teamLabel(series, 'red')} 픽 이력`} team="red" players={series.red} series={series} />
    </div>
  );
}
