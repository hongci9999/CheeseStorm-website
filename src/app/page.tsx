'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStreamers, getMatches, isFirebaseConfigured } from '@/lib/firestore';
import { calcPlayerStats, groupStatsByTier } from '@/lib/tier';
import { calcHeroTiers, groupHeroesByTier } from '@/lib/hero-tier';
import type { HeroTierStat } from '@/lib/hero-tier';
import type { PlayerStats, Role, Tier } from '@/lib/types';
import { MOCK_STATS } from '@/test/fixtures';
import { MOCK_MATCHES } from '@/test/fixtures/matches';
import { HexAvatar, HEX_CLIP, TIER_COLOR_VAR } from '@/components/hexagon-avatar';

// 상위 탭 종류
type MainTab = 'auto' | 'curation' | 'hero';

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

// ── 역할 필터 바 (역할 탭만 — 검색 입력 제거) ────────────────────
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

// ── 상위 탭 바 — FilterBar와 계층이 명확히 다른 스타일 ────────────
const MAIN_TAB_LABELS: Record<MainTab, string> = {
  auto:     '스트리머 자동',
  curation: '스트리머 큐레이션',
  hero:     '영웅',
};

function MainTabBar({ tab, onTab }: { tab: MainTab; onTab: (t: MainTab) => void }) {
  return (
    // 하단 보더 라인으로 탭 컨테이너를 구분
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '2px solid var(--border-line)',
      marginBottom: 'var(--sp-6)',
    }}>
      {(Object.keys(MAIN_TAB_LABELS) as MainTab[]).map(t => {
        const active = tab === t;
        return (
          <button
            key={t}
            onClick={() => onTab(t)}
            style={{
              position: 'relative',
              height: 44, padding: '0 20px',
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
              fontSize: 14,
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color var(--dur-fast) var(--ease-out)',
              // 선택된 탭의 하단 강조선 (역할 필터의 pill 스타일과 명확히 다름)
              borderBottom: active
                ? '2px solid var(--cheese-green)'
                : '2px solid transparent',
              marginBottom: -2, // 컨테이너 보더와 겹쳐 선택선이 border-bottom 위에 오도록
            }}
          >
            {MAIN_TAB_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

// ── 자동 티어리스트 탭 콘텐츠 ───────────────────────────────────
function AutoTierTab({ stats }: { stats: PlayerStats[] }) {
  const [role, setRole] = useState('전체');

  const filtered = stats.filter(p => {
    if (role !== '전체' && p.role !== role) return false;
    return true;
  });

  const groups = groupStatsByTier(filtered);

  return (
    <div>
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
    </div>
  );
}

// ── 영웅 타일 (초성 기반, 티어색 테두리) ────────────────────────
function HeroTile({ name, ring, size = 54 }: { name: string; ring: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 'var(--r-md)', flexShrink: 0,
      background: 'var(--surface-raise)', border: `2px solid ${ring}`,
      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: Math.round(size * 0.34),
      color: 'var(--text-high)',
    }}>
      {name.slice(0, 2)}
    </span>
  );
}

// ── 영웅 셀 ───────────────────────────────────────────────────
function HeroCell({ h, tier }: { h: HeroTierStat; tier: Tier }) {
  const win = h.winRate >= 0.5;
  const ring = `var(${TIER_COLOR_VAR[tier]})`;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      width: 78, padding: 'var(--sp-3) 4px', borderRadius: 'var(--r-md)',
    }}>
      <HeroTile name={h.hero} ring={ring} size={54} />
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
        color: 'var(--text-high)', maxWidth: 74,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {h.hero}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 12,
          color: win ? 'var(--win)' : 'var(--text-faint)',
        }}>
          {Math.round(h.winRate * 100)}%
        </span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-600)' }} />
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11, color: 'var(--text-faint)' }}>
          {h.games}판
        </span>
      </div>
    </div>
  );
}

// ── 영웅 티어 행 ──────────────────────────────────────────────
function HeroTierRow({ tier, heroes }: { tier: Tier; heroes: HeroTierStat[] }) {
  const isS = tier === 'S';
  const color = `var(${TIER_COLOR_VAR[tier]})`;

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'stretch', overflow: 'hidden',
      borderRadius: 'var(--r-lg)', background: 'var(--surface-card)',
      border: `1px solid ${isS ? 'var(--border-glow)' : 'var(--border-line)'}`,
      boxShadow: isS ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
    }}>
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: color, boxShadow: `0 0 14px ${color}`,
      }} />
      <div style={{
        width: 148, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: 'var(--sp-5) var(--sp-4)',
        borderRight: '1px solid var(--border-faint)',
        background: isS ? 'var(--grad-sweep)' : 'transparent',
      }}>
        <TierBadge tier={tier} size="lg" />
        <span style={{
          fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.14em',
          color: 'var(--text-faint)',
        }}>
          {heroes.length}영웅
        </span>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center', padding: 'var(--sp-4)',
      }}>
        {heroes.map((h) => (
          <HeroCell key={h.hero} h={h} tier={tier} />
        ))}
      </div>
    </div>
  );
}

// ── 영웅 티어리스트 탭 콘텐츠 (#20) ────────────────────────────
function HeroTierTab({ heroTiers }: { heroTiers: HeroTierStat[] }) {
  const [role, setRole] = useState('전체');

  const filtered = heroTiers.filter((h) => role === '전체' || h.role === role);
  const groups = groupHeroesByTier(filtered);

  return (
    <div>
      <FilterBar role={role} onRole={setRole} />
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
          집계된 영웅이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {groups.map(({ tier, heroes }) => (
            <HeroTierRow key={tier} tier={tier} heroes={heroes} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 준비 중 플레이스홀더 탭 ────────────────────────────────────
function PlaceholderTab({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 240, gap: 'var(--sp-3)',
      color: 'var(--text-faint)',
    }}>
      <span style={{ fontSize: 32 }}>🚧</span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15 }}>
        {label} — 준비 중
      </span>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [heroTiers, setHeroTiers] = useState<HeroTierStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>('auto');

  useEffect(() => {
    async function load() {
      if (!isFirebaseConfigured) {
        setStats(MOCK_STATS);
        setHeroTiers(calcHeroTiers(MOCK_MATCHES));
        setLoading(false);
        return;
      }
      try {
        const [streamers, matches] = await Promise.all([getStreamers(), getMatches()]);
        const computed = calcPlayerStats(streamers, matches);
        const hasData = computed.length > 0 && matches.length > 0;
        setStats(hasData ? computed : MOCK_STATS);
        setHeroTiers(hasData ? calcHeroTiers(matches) : calcHeroTiers(MOCK_MATCHES));
      } catch {
        setStats(MOCK_STATS);
        setHeroTiers(calcHeroTiers(MOCK_MATCHES));
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 80 }}>불러오는 중...</div>;
  }

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

      {/* 상위 3대 탭 — 역할 필터와 시각적 계층 구분 */}
      <MainTabBar tab={mainTab} onTab={setMainTab} />

      {/* 탭 패널 */}
      {mainTab === 'auto' && <AutoTierTab stats={stats} />}
      {mainTab === 'curation' && <PlaceholderTab label="스트리머 큐레이션" />}
      {mainTab === 'hero' && <HeroTierTab heroTiers={heroTiers} />}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
