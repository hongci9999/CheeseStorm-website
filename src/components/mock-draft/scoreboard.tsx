'use client';

import type { Series } from '@/lib/draft/types';

export function Scoreboard({ series }: Props) {
  const blueWins = series.sets.filter((s) => s.winner === 'blue').length;
  const redWins = series.sets.filter((s) => s.winner === 'red').length;
  const needed = series.bestOf === 3 ? 2 : 3;
  const clinched = blueWins >= needed ? 'blue' : redWins >= needed ? 'red' : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', fontWeight: 700 }}>
      <span style={{ color: '#3b82f6' }}>블루 {blueWins}</span>
      <span>-</span>
      <span style={{ color: '#ef4444' }}>{redWins} 레드</span>
      {clinched && (
        <span style={{ marginLeft: 8, fontSize: 13 }}>
          🏆 {clinched === 'blue' ? '블루' : '레드'} 시리즈 승리
        </span>
      )}
    </div>
  );
}

interface Props {
  series: Series;
}
