'use client';

import { useEffect, useState } from 'react';
import { getStreamers, getMatches } from '@/lib/firestore';
import { calcPlayerStats, groupStatsByTier } from '@/lib/tier';
import type { PlayerStats, Tier } from '@/lib/types';

const TIER_COLOR: Record<Tier, string> = {
  S: 'var(--tier-s)', A: 'var(--tier-a)', B: 'var(--tier-b)',
  C: 'var(--tier-c)', D: 'var(--tier-d)', unranked: 'var(--ink-500)',
};
const TIER_DESC: Record<Tier, string> = {
  S: '에이펙스', A: '상위', B: '중상위', C: '중위', D: '기반', unranked: '미배정',
};

function pct(p: PlayerStats) {
  return p.totalGames > 0 ? Math.round(p.winRate * 100) : 0;
}

function TierBadge({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 52 : size === 'md' ? 36 : 26;
  const fs = size === 'lg' ? 22 : size === 'md' ? 15 : 11;
  const color = TIER_COLOR[tier];
  return (
    <div style={{
      width: sz, height: sz, borderRadius: 'var(--r-sm)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: `color-mix(in srgb, ${color} 18%, transparent)`,
      border: `1.5px solid ${color}`,
      color, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: fs,
    }}>
      {tier === 'unranked' ? '?' : tier}
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [streamers, matches] = await Promise.all([getStreamers(), getMatches()]);
      setStats(calcPlayerStats(streamers, matches));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 80 }}>불러오는 중...</div>;
  }

  if (stats.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 80 }}>
        <p style={{ fontSize: 20, marginBottom: 8 }}>아직 데이터가 없습니다</p>
        <p style={{ fontSize: 13 }}>스트리머를 추가하고 경기 결과를 입력해 주세요.</p>
      </div>
    );
  }

  const groups = groupStatsByTier(stats);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--text-strong)', marginBottom: 4 }}>티어리스트</h1>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>승률 기준 · 최소 3경기 이상 시 티어 부여</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {groups.map(({ tier, players }) => {
          const isS = tier === 'S';
          const color = TIER_COLOR[tier];
          return (
            <div key={tier} style={{
              position: 'relative', display: 'flex', alignItems: 'stretch',
              borderRadius: 'var(--r-lg)', overflow: 'hidden',
              background: 'var(--surface-card)',
              border: `1px solid ${isS ? 'var(--border-glow)' : 'var(--border-line)'}`,
              boxShadow: isS ? '0 0 32px rgba(0,255,163,0.08)' : 'none',
            }}>
              {/* 컬러 엣지 바 */}
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                background: color, boxShadow: `0 0 12px ${color}`, flexShrink: 0 }} />

              {/* 티어 컬럼 */}
              <div style={{
                width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: 'var(--sp-4) var(--sp-3)',
                borderRight: '1px solid var(--border-faint)',
                background: isS ? 'linear-gradient(135deg, rgba(0,255,163,0.05) 0%, transparent 60%)' : 'transparent',
              }}>
                <TierBadge tier={tier} size="lg" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                  {TIER_DESC[tier]}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-numeral)', letterSpacing: '0.1em' }}>
                  {players.length}명
                </span>
              </div>

              {/* 플레이어 */}
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
                alignContent: 'center', padding: 'var(--sp-3) var(--sp-4)' }}>
                {players.map((p) => (
                  <div key={p.streamerId} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    width: 72, padding: '10px 4px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: `color-mix(in srgb, ${color} 20%, var(--surface-raise))`,
                      border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color,
                    }}>
                      {p.streamerName[0]}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-high)',
                      maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-ui)' }}>
                      {p.streamerName}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-numeral)', fontWeight: 700,
                      color: pct(p) >= 50 ? 'var(--win)' : 'var(--text-faint)' }}>
                      {pct(p)}%
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-numeral)' }}>
                      {p.wins}W {p.losses}L
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
