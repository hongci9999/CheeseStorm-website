'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStreamers, getMatches, isFirebaseConfigured } from '@/lib/firestore';
import { calcPlayerStats, groupStatsByTier } from '@/lib/tier';
import type { PlayerStats, Role, Tier } from '@/lib/types';
import { MOCK_STATS } from '@/test/fixtures';
import { HexAvatar, HEX_CLIP, TIER_COLOR_VAR } from '@/components/hexagon-avatar';

const ROLES: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

function pct(p: PlayerStats) {
  return p.totalGames > 0 ? Math.round(p.winRate * 100) : 0;
}

// ── TierBadge — DS 스펙 그대로: 꽉 찬 헥사곤 + glow + 어두운 텍스트
function TierBadge({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 28, md: 40, lg: 56, xl: 84 }[size] ?? 40;
  const fs   = { sm: 14, md: 20, lg: 28, xl: 44 }[size] ?? 20;
  const color = `var(${TIER_COLOR_VAR[tier]})`;
  const label = tier === 'unranked' ? '?' : tier;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: dims, height: dims,
      alignItems: 'center', justifyContent: 'center' }}>
      {/* 꽉 찬 헥사곤 fill + glow */}
      <span style={{
        position: 'absolute', inset: 0,
        background: color, clipPath: HEX_CLIP,
        filter: `drop-shadow(0 0 10px ${color})`,
      }} />
      {/* 텍스트 — 어두운 색으로 */}
      <span style={{
        position: 'relative', fontFamily: 'var(--font-display)', fontWeight: 900,
        fontSize: fs, lineHeight: 1, color: 'var(--ink-1000)', paddingBottom: 2,
      }}>
        {label}
      </span>
    </span>
  );
}

// ── 플레이어 셀 ───────────────────────────────────────────────
function PlayerCell({ p, rank, tier }: { p: PlayerStats; rank: number; tier: Tier }) {
  const [hover, setHover] = useState(false);
  const win = pct(p) >= 50;

  return (
    <Link
      href={`/streamers/${p.streamerId}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        width: 78, padding: 'var(--sp-3) 4px', borderRadius: 'var(--r-md)', cursor: 'pointer',
        background: hover ? 'var(--surface-raise)' : 'transparent',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
        textDecoration: 'none',
      }}
    >
      {/* 아바타 + S티어 순위 뱃지 */}
      <div style={{ position: 'relative' }}>
        <HexAvatar
          name={p.streamerName}
          imageUrl={p.profileImageUrl}
          ring={`var(${TIER_COLOR_VAR[tier]})`}
          ringWidth={tier !== 'unranked' ? 2 : 1.5}
          size={54}
        />
        {rank <= 3 && tier === 'S' && (
          <span style={{
            position: 'absolute', top: -4, left: -4, width: 18, height: 18,
            borderRadius: '50%', background: 'var(--mvp)', color: 'var(--bg-void)',
            fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px var(--surface-card)',
          }}>
            {rank}
          </span>
        )}
      </div>

      {/* 이름 */}
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
        color: 'var(--text-high)', maxWidth: 74,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {p.streamerName}
      </span>

      {/* 승률 · 전적 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 12,
          color: win ? 'var(--win)' : 'var(--text-faint)',
        }}>
          {pct(p)}%
        </span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-600)' }} />
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11, color: 'var(--text-faint)' }}>
          {p.wins}W {p.losses}L
        </span>
      </div>
    </Link>
  );
}

// ── 티어 행 ───────────────────────────────────────────────────
function TierRow({ tier, players }: { tier: Tier; players: PlayerStats[] }) {
  const isS = tier === 'S';
  const color = `var(${TIER_COLOR_VAR[tier]})`;

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'stretch', overflow: 'hidden',
      borderRadius: 'var(--r-lg)', background: 'var(--surface-card)',
      border: `1px solid ${isS ? 'var(--border-glow)' : 'var(--border-line)'}`,
      boxShadow: isS ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
    }}>
      {/* 컬러 엣지 바 */}
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: color, boxShadow: `0 0 14px ${color}`,
      }} />

      {/* 티어 컬럼 */}
      <div style={{
        width: 148, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: 'var(--sp-5) var(--sp-4)',
        borderRight: '1px solid var(--border-faint)',
        background: isS ? 'var(--grad-sweep)' : 'transparent',
      }}>
        <TierBadge tier={tier} size="lg" />
        {/* 인원 수만 표시 — 수사적 등급 부가문구 제거 */}
        <span style={{
          fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.14em',
          color: 'var(--text-faint)',
        }}>
          {players.length}명
        </span>
      </div>

      {/* 아바타 플로우 */}
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center', padding: 'var(--sp-4)',
      }}>
        {players.map((p, i) => (
          <PlayerCell key={p.streamerId} p={p} rank={i + 1} tier={tier} />
        ))}
      </div>
    </div>
  );
}

// ── 필터 바 (역할 탭만 — 검색 입력 제거) ────────────────────
function FilterBar({ role, onRole }: { role: string; onRole: (v: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      flexWrap: 'wrap', marginBottom: 'var(--sp-5)',
    }}>
      {/* 역할 탭 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['전체', ...ROLES].map(r => (
          <button
            key={r}
            onClick={() => onRole(r)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 'var(--r-pill)',
              border: `1px solid ${role === r ? 'var(--cheese-green)' : 'var(--border-line)'}`,
              background: role === r ? 'color-mix(in srgb, var(--cheese-green) 15%, transparent)' : 'transparent',
              color: role === r ? 'var(--cheese-green)' : 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
              cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('전체');

  useEffect(() => {
    async function load() {
      if (!isFirebaseConfigured) {
        setStats(MOCK_STATS);
        setLoading(false);
        return;
      }
      try {
        const [streamers, matches] = await Promise.all([getStreamers(), getMatches()]);
        const computed = calcPlayerStats(streamers, matches);
        setStats(computed.length > 0 ? computed : MOCK_STATS);
      } catch {
        setStats(MOCK_STATS);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 80 }}>불러오는 중...</div>;
  }

  const filtered = stats.filter(p => {
    if (role !== '전체' && p.role !== role) return false;
    return true;
  });

  const groups = groupStatsByTier(filtered);

  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-3xl)',
          color: 'var(--text-strong)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0,
        }}>
          티어리스트
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          승률 기준 · 최소 3경기 이상 시 티어 부여
        </p>
      </div>

      <FilterBar role={role} onRole={setRole} />

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {groups.map(({ tier, players }) => (
            <TierRow key={tier} tier={tier} players={players} />
          ))}
        </div>
      )}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
