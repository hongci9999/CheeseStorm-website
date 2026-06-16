'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getStreamers, getMatches, getCachedStreamers, getCachedMatches, getPrecomputedStats } from '@/lib/firestore';
import { calcPlayerStats, groupStatsByTier } from '@/lib/tier';
import { calcHeroTiers, groupHeroesByTier } from '@/lib/hero-tier';
import type { HeroTierStat } from '@/lib/hero-tier';
import type { PlayerStats, FineRole, Tier } from '@/lib/types';
import { HexAvatar, HEX_CLIP, TIER_COLOR_VAR } from '@/components/hexagon-avatar';
import { CurationTierTab } from '@/components/curation-tier-tab';
import { heroImageUrl } from '@/lib/hero-image';
import type { Match, Streamer } from '@/lib/types';
import { useBreakpoint, type Bp } from '@/hooks/use-breakpoint';

// 상위 탭 종류
type MainTab = 'auto' | 'curation' | 'hero';

const ROLES: FineRole[] = ['탱커', '투사', '원거리 암살자', '근접 암살자', '지원가', '전문가'];

// ── 초기 로딩 스켈레톤 — stats/matches 첫 fetch 동안 표시 ──────────
const SKEL: React.CSSProperties = {
  borderRadius: 'var(--r-sm)',
  background: 'var(--surface-raise)',
  animation: 'skel-pulse 1.5s ease-in-out infinite',
};

function TierRowSkeleton({ avatarCount }: { avatarCount: number }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'stretch', overflow: 'hidden',
      borderRadius: 'var(--r-lg)', background: 'var(--surface-card)',
      border: '1px solid var(--border-line)',
    }}>
      <div style={{
        width: 148, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sp-3) var(--sp-4)', borderRight: '1px solid var(--border-faint)',
      }}>
        <div style={{ ...SKEL, width: 56, height: 56, borderRadius: '50%' }} />
      </div>
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center', padding: 'var(--sp-2) var(--sp-4)', minHeight: 88,
      }}>
        {Array.from({ length: avatarCount }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 78,
          }}>
            <div style={{ ...SKEL, width: 54, height: 54, borderRadius: '50%' }} />
            <div style={{ ...SKEL, width: 60, height: 11 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TierListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {[6, 5, 4, 3, 2].map((count, i) => <TierRowSkeleton key={i} avatarCount={count} />)}
    </div>
  );
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
function PlayerCell({ p, tier, bp }: { p: PlayerStats; tier: Tier; bp: Bp }) {
  const [hover, setHover] = useState(false);
  const isMobile = bp === 'mobile';

  return (
    <Link
      href={`/streamers/${p.streamerId}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        width: isMobile ? 60 : 78, padding: 'var(--sp-3) 4px', borderRadius: 'var(--r-md)', cursor: 'pointer',
        background: hover ? 'var(--surface-raise)' : 'transparent',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
        textDecoration: 'none',
      }}
    >
      {/* 아바타 */}
      <HexAvatar
        name={p.streamerName}
        imageUrl={p.profileImageUrl}
        ring={`var(${TIER_COLOR_VAR[tier]})`}
        ringWidth={tier !== 'unranked' ? 2 : 1.5}
        size={isMobile ? 40 : 54}
      />

      {/* 이름 */}
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: isMobile ? 11 : 12.5,
        color: 'var(--text-high)', maxWidth: isMobile ? 56 : 74,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {p.streamerName}
      </span>

    </Link>
  );
}

// ── 티어 행 ───────────────────────────────────────────────────
function TierRow({ tier, players, bp }: { tier: Tier; players: PlayerStats[]; bp: Bp }) {
  const isS = tier === 'S';
  const color = `var(${TIER_COLOR_VAR[tier]})`;
  const isMobile = bp === 'mobile';

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
        width: isMobile ? 72 : 148, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: isMobile ? 'var(--sp-2) var(--sp-2)' : 'var(--sp-3) var(--sp-4)',
        borderRight: '1px solid var(--border-faint)',
        background: isS ? 'var(--grad-sweep)' : 'transparent',
      }}>
        <TierBadge tier={tier} size={isMobile ? 'sm' : 'lg'} />
        {tier === 'unranked' && (
          <span style={{
            fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.1em',
            color: 'var(--text-faint)', textAlign: 'center',
          }}>
            미배정
          </span>
        )}
      </div>

      {/* 아바타 플로우 — 큐레이션 티어행과 동일한 최소 높이 */}
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center',
        padding: isMobile ? 'var(--sp-1) var(--sp-2)' : 'var(--sp-2) var(--sp-4)',
        minHeight: 88,
      }}>
        {players.map((p) => (
          <PlayerCell key={p.streamerId} p={p} tier={tier} bp={bp} />
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
  curation: '스트리머 티어표',
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

// ── 자동 티어 안내 ─────────────────────────────────────────────
function AutoTierNotice() {
  return (
    <div style={{
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in srgb, var(--tier-b) 55%, var(--border-line))',
      background: 'color-mix(in srgb, var(--tier-b) 14%, var(--surface-card))',
      padding: 'var(--sp-3) var(--sp-4)',
      marginBottom: 'var(--sp-5)',
    }}>
      <p style={{
        margin: 0, fontSize: 13, fontFamily: 'var(--font-ui)',
        color: 'var(--tier-b)', fontWeight: 600, lineHeight: 1.55,
      }}>
        본 티어표는 승률과 스탯 전반적인 수치를 종합하여 자동으로 설정된 티어표입니다. 스트리머 티어표 탭에서 티어표를 만들어주세요
      </p>
    </div>
  );
}

// ── 자동 티어리스트 탭 콘텐츠 ───────────────────────────────────
function AutoTierTab({ stats, bp }: { stats: PlayerStats[]; bp: Bp }) {
  const [role, setRole] = useState('전체');

  const filtered = useMemo(
    () => stats.filter(p => role === '전체' || p.fineRole === role),
    [stats, role],
  );

  const groups = useMemo(() => groupStatsByTier(filtered), [filtered]);

  return (
    <div>
      <AutoTierNotice />
      <FilterBar role={role} onRole={setRole} />
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {groups.map(({ tier, players }) => (
            <TierRow key={tier} tier={tier} players={players} bp={bp} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 영웅 타일 (육각형, 티어색 테두리) — 영웅 사진 있으면 표시, 없으면 이니셜 폴백
function HeroTile({ name, ring, size = 54 }: { name: string; ring: string; size?: number }) {
  return <HexAvatar name={name} imageUrl={heroImageUrl(name)} ring={ring} size={size} ringWidth={2} />;
}

// ── 영웅 셀 ───────────────────────────────────────────────────
function HeroCell({ h, tier, bp }: { h: HeroTierStat; tier: Tier; bp: Bp }) {
  const win = h.winRate >= 0.5;
  const ring = `var(${TIER_COLOR_VAR[tier]})`;
  const isMobile = bp === 'mobile';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      width: isMobile ? 60 : 78, padding: 'var(--sp-3) 4px', borderRadius: 'var(--r-md)',
    }}>
      <HeroTile name={h.hero} ring={ring} size={isMobile ? 40 : 54} />
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: isMobile ? 11 : 12.5,
        color: 'var(--text-high)', maxWidth: isMobile ? 56 : 74,
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
function HeroTierRow({ tier, heroes, bp }: { tier: Tier; heroes: HeroTierStat[]; bp: Bp }) {
  const isS = tier === 'S';
  const color = `var(${TIER_COLOR_VAR[tier]})`;
  const isMobile = bp === 'mobile';

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
        width: isMobile ? 72 : 148, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: isMobile ? 'var(--sp-2) var(--sp-2)' : 'var(--sp-3) var(--sp-4)',
        borderRight: '1px solid var(--border-faint)',
        background: isS ? 'var(--grad-sweep)' : 'transparent',
      }}>
        <TierBadge tier={tier} size={isMobile ? 'sm' : 'lg'} />
        <span style={{
          fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.14em',
          color: 'var(--text-faint)',
        }}>
          {heroes.length}영웅
        </span>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center',
        padding: isMobile ? 'var(--sp-1) var(--sp-2)' : 'var(--sp-2) var(--sp-4)',
      }}>
        {heroes.map((h) => (
          <HeroCell key={h.hero} h={h} tier={tier} bp={bp} />
        ))}
      </div>
    </div>
  );
}

// ── 영웅 티어리스트 탭 콘텐츠 (#20) ────────────────────────────
function HeroTierTab({ heroTiers, bp }: { heroTiers: HeroTierStat[]; bp: Bp }) {
  const [role, setRole] = useState('전체');

  const filtered = useMemo(
    () => heroTiers.filter((h) => role === '전체' || h.fineRole === role),
    [heroTiers, role],
  );

  const groups = useMemo(() => groupHeroesByTier(filtered), [filtered]);

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
            <HeroTierRow key={tier} tier={tier} heroes={heroes} bp={bp} />
          ))}
        </div>
      )}
    </div>
  );
}

function computeHome(streamers: Parameters<typeof calcPlayerStats>[0], matches: Parameters<typeof calcHeroTiers>[0]) {
  return {
    stats: calcPlayerStats(streamers, matches),
    heroTiers: calcHeroTiers(matches),
  };
}

// ── 페이지 ────────────────────────────────────────────────────
export default function HomePage() {
  // 캐시가 있으면 첫 렌더에서 바로 계산해 스피너·재요청을 건너뛴다 (SPA 재방문 시)
  const cachedStreamers = getCachedStreamers();
  const cachedMatches = getCachedMatches();
  const initial = cachedStreamers !== null && cachedMatches !== null
    ? computeHome(cachedStreamers, cachedMatches) : null;
  const [stats, setStats] = useState<PlayerStats[]>(initial?.stats ?? []);
  const [heroTiers, setHeroTiers] = useState<HeroTierStat[]>(initial?.heroTiers ?? []);
  const [streamers, setStreamers] = useState<Streamer[]>(cachedStreamers ?? []);
  const [matches, setMatches] = useState<Match[]>(cachedMatches ?? []);
  const [loading, setLoading] = useState(initial === null);
  const [mainTab, setMainTab] = useState<MainTab>('auto');
  const bp = useBreakpoint();

  useEffect(() => {
    async function load() {
      // stats/current가 있으면 1 read로 즉시 표시 (방문자 최적화)
      const precomputed = await getPrecomputedStats();
      if (precomputed) {
        setStats(precomputed.playerStats);
        setHeroTiers(precomputed.heroTiers);
        setLoading(false);
        // 큐레이션 탭은 자체적으로 데이터를 로드하므로 streamers/matches 불필요
        return;
      }
      // 폴백: stats/current 없으면 전체 컬렉션 읽기 (초기 배포, 집계 전)
      const [streamers, matches] = await Promise.all([
        getStreamers({ fresh: true }),
        getMatches(),
      ]);
      const next = computeHome(streamers, matches);
      setStreamers(streamers);
      setMatches(matches);
      setStats(next.stats);
      setHeroTiers(next.heroTiers);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div>
        {/* 페이지 헤더 */}
        <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
          <div style={{ ...SKEL, width: 160, height: 36, borderRadius: 'var(--r-sm)' }} />
          <div style={{ ...SKEL, width: 200, height: 14, marginTop: 10 }} />
        </div>
        <TierListSkeleton />
      </div>
    );
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
          TIER LIST
        </p>
      </div>

      {/* 상위 3대 탭 — 역할 필터와 시각적 계층 구분 */}
      <MainTabBar tab={mainTab} onTab={setMainTab} />

      {/* 탭 패널 */}
      {mainTab === 'auto' && <AutoTierTab stats={stats} bp={bp} />}
      {mainTab === 'curation' && (
        <CurationTierTab streamers={streamers} matches={matches} />
      )}
      {mainTab === 'hero' && <HeroTierTab heroTiers={heroTiers} bp={bp} />}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
