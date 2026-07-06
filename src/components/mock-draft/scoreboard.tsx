'use client';

import type { Series } from '@/lib/draft/types';
import { card, teamColor, teamLabel } from './ui';

export function Scoreboard({ series }: Props) {
  const blueWins = series.sets.filter((s) => s.winner === 'blue').length;
  const redWins = series.sets.filter((s) => s.winner === 'red').length;
  const needed = series.bestOf === 3 ? 2 : 3;
  const clinched = blueWins >= needed ? 'blue' : redWins >= needed ? 'red' : null;

  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', justifyContent: 'center',
      padding: 'var(--sp-3) var(--sp-4)', fontFamily: 'var(--font-numeral)' }}>
      <span style={{ color: teamColor('blue'), fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{teamLabel(series, 'blue')} {blueWins}</span>
      <span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>–</span>
      <span style={{ color: teamColor('red'), fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{redWins} {teamLabel(series, 'red')}</span>
      {clinched && (
        <span style={{ marginLeft: 'var(--sp-2)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)',
          fontWeight: 700, color: teamColor(clinched) }}>
          🏆 {teamLabel(series, clinched)} 시리즈 승리
        </span>
      )}
    </div>
  );
}

interface Props {
  series: Series;
}
