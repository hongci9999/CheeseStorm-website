import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStreamersCachedServer, getMatchCachedServer } from '@/lib/firestore.server';
import { displaySides } from '@/lib/match';
import { HeroTeamStack, MatchDetail } from '@/components/match-detail';

function fmtFullDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [streamers, match] = await Promise.all([
    getStreamersCachedServer(),
    getMatchCachedServer(id),
  ]);
  if (!match) notFound();

  const { left, right } = displaySides(match);
  const leftHeroes = left.roster.map(([, h]) => h);
  const rightHeroes = right.roster.map(([, h]) => h);

  return (
    <div style={{ padding: 'var(--sp-7) 0 var(--sp-20)' }}>
      {/* 뒤로가기 */}
      <Link href="/matches" style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 'var(--sp-4)',
      }}>
        ← 내전기록실
      </Link>

      {/* 경기 카드 */}
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        {/* 헤더: 맵 · 날짜 · 시간 + 영웅 VS */}
        <div style={{ padding: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)',
            flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-2xl)',
              color: 'var(--text-strong)', letterSpacing: '-0.01em', margin: 0 }}>
              {match.map ?? '전장 미기록'}
            </h1>
            <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 13, color: 'var(--text-faint)' }}>
              {fmtFullDate(match.date)}{match.dur ? ` · ${match.dur}` : ''}
            </span>
          </div>

          {/* 영웅 VS — 이긴 쪽 강조 (팀 색깔 없음) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <HeroTeamStack heroes={leftHeroes} won={left.won} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
              color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
            <HeroTeamStack heroes={rightHeroes} won={right.won} />
          </div>
        </div>

        {/* 팀별 상세 스탯 */}
        <MatchDetail match={match} streamers={streamers} />
      </div>
    </div>
  );
}
