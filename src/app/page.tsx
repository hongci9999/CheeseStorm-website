'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import type { EloDetail, EloMatchDetail } from '@/lib/elo';
import { useBreakpoint, type Bp } from '@/hooks/use-breakpoint';

// 상위 탭 종류
type MainTab = 'auto' | 'elo' | 'curation' | 'hero';

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
      prefetch={false}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        width: isMobile ? 60 : 78, padding: 'var(--sp-2) 4px', borderRadius: 'var(--r-md)', cursor: 'pointer',
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
        size={isMobile ? 46 : 60}
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
            판수 부족
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
  curation: '스트리머 수동 티어표',
  auto:     '스트리머 자동 티어표',
  elo:      'Elo 순위표',
  hero:     '내전 영웅 티어표',
};

function MainTabBar({ tab, onTab }: { tab: MainTab; onTab: (t: MainTab) => void }) {
  return (
    // 하단 보더 라인으로 탭 컨테이너를 구분
    // 좁은 화면에선 가로 스크롤(터치 드래그)로 탭 이동
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '2px solid var(--border-line)',
      marginBottom: 'var(--sp-6)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
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
              flexShrink: 0, whiteSpace: 'nowrap',
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
        본 티어표는 승률과 스탯 전반적인 수치를 종합하여 자동으로 설정된 티어표입니다. 부정확한 티어표 이므로 재미로만 보시고 참조용으로만 활용하시기 바랍니다.
      </p>
    </div>
  );
}

// ── 티어 기준 안내 버튼 (! 호버/클릭 → 툴팁) — 자동·영웅 탭 공용 ──
function TierInfoButton({ ariaLabel, title, children }: {
  ariaLabel: string; title: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '1px solid var(--border-line)', background: 'var(--surface-rail)',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 13, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color var(--dur-fast), border-color var(--dur-fast)',
        }}
      >
        !
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 'var(--z-popover, 50)',
            width: 290, maxWidth: '80vw',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-line)',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.3))',
            textAlign: 'left',
          }}
        >
          <p style={{
            margin: '0 0 8px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            fontSize: 13, color: 'var(--text-strong)',
          }}>
            {title}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

function AutoTierInfoButton() {
  return (
    <TierInfoButton ariaLabel="자동 티어 기준 안내" title="자동 티어 산정 기준">
      <p style={{
        margin: '0 0 10px', fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.6,
        color: 'var(--text-muted)',
      }}>
        경기 <b style={{ color: 'var(--text-high)' }}>승패</b>와 경기 내
        <b style={{ color: 'var(--text-high)' }}> 스탯(딜·힐·공성 등)</b>을 함께 반영한
        종합 점수로 티어를 매깁니다. 현재는 스탯 가중치를 높게 설정된 상태이고, 표본
        <b style={{ color: 'var(--text-high)' }}> 5경기 이상</b>부터 티어가 부여되고
        미만은 <b style={{ color: 'var(--text-high)' }}>?</b> 티어입니다.
      </p>
      <p style={{
        margin: 0, fontFamily: 'var(--font-ui)', fontSize: 11, lineHeight: 1.55,
        color: 'var(--text-faint)',
      }}>
        ※ 내전은 팀이 의도적으로 밸런싱되므로 승률만으로 개인 실력을 측정할 수 없습니다.
        자동 티어는 실력 지표가 아닌 <b>전적 요약</b>이며 참고용입니다.
      </p>
    </TierInfoButton>
  );
}

// ── Elo 순위표 주의 문구 ───────────────────────────────────────
function EloNotice() {
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
        Elo는 경기의 승패와 상대 팀의 강함만으로 자동 계산된 점수입니다. 개인의 활약이나 스탯은 반영되지 않으며, 판수가 적으면 신뢰도가 낮습니다. 재미로만 보시고 참고용으로만 활용하시기 바랍니다.
      </p>
    </div>
  );
}

// ── Elo 산정 기준 안내 버튼 ───────────────────────────────────
function EloInfoButton() {
  return (
    <TierInfoButton ariaLabel="Elo 산정 기준 안내" title="Elo 산정 기준">
      <p style={{
        margin: '0 0 10px', fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.6,
        color: 'var(--text-muted)',
      }}>
        모두 <b style={{ color: 'var(--text-high)' }}>1500점</b>에서 시작합니다. 매 경기
        양 팀의 <b style={{ color: 'var(--text-high)' }}>평균 Elo</b>로 기대 승률을 구하고,
        기대보다 잘하면 오르고 못하면 내려갑니다. 강한 팀을 이기면 많이 오르고, 약한 팀에
        지면 많이 떨어집니다. 같은 팀 5명은 <b style={{ color: 'var(--text-high)' }}>같은 점수</b>를
        주고받습니다.
      </p>
      <p style={{
        margin: 0, fontFamily: 'var(--font-ui)', fontSize: 11, lineHeight: 1.55,
        color: 'var(--text-faint)',
      }}>
        ※ 승패만 보는 지표라 개인 기여도(딜·힐·공성)는 반영되지 않습니다. 내전은 팀이
        의도적으로 밸런싱되므로 <b>실력 순위가 아닌 전적 기반 참고 지표</b>로만 보시기 바랍니다.
        각 행을 누르면 계산 과정을 볼 수 있습니다.
      </p>
    </TierInfoButton>
  );
}

// ── 영웅 티어 기준 안내 버튼 ───────────────────────────────────
function HeroTierInfoButton() {
  return (
    <TierInfoButton ariaLabel="영웅 티어 기준 안내" title="영웅 티어 산정 기준">
      <p style={{
        margin: '0 0 10px', fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.6,
        color: 'var(--text-muted)',
      }}>
        해당 영웅이 플레이된 모든 경기의 <b style={{ color: 'var(--text-high)' }}>승률</b>로
        티어를 매깁니다. 표본이 적을 땐 극단값을 막기 위해 승률을 50%에 가깝게
        <b style={{ color: 'var(--text-high)' }}> 보정</b>하고, 표본
        <b style={{ color: 'var(--text-high)' }}> 5경기 이상</b>부터 티어가 부여되며
        미만은 <b style={{ color: 'var(--text-high)' }}>?</b> 티어입니다.
      </p>
      <p style={{
        margin: 0, fontFamily: 'var(--font-ui)', fontSize: 11, lineHeight: 1.55,
        color: 'var(--text-faint)',
      }}>
        ※ 소수의 스트리머가 독점한 영웅은 표본 편향이 크므로 점수를 조금 낮춥니다.
        여러 스트리머가 고루 사용할수록 보정이 사라집니다.
      </p>
    </TierInfoButton>
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FilterBar role={role} onRole={setRole} />
        </div>
        <div style={{ flexShrink: 0, height: 32, display: 'flex', alignItems: 'center' }}>
          <AutoTierInfoButton />
        </div>
      </div>
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

// ── Elo 상세 정보 패널 ───────────────────────────────────────
// 세션 내 재클릭 시 API 재호출 방지 (서버는 unstable_cache로 Firestore 읽기 0)
const eloDetailCache = new Map<string, EloDetail>();

function EloDetailPanel({ streamerId, isMobile }: { streamerId: string; isMobile: boolean }) {
  const cached = eloDetailCache.get(streamerId) ?? null;
  const [detail, setDetail] = useState<EloDetail | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eloDetailCache.has(streamerId)) return;
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/elo-details?streamerId=${streamerId}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json() as EloDetail;
        eloDetailCache.set(streamerId, data);
        setDetail(data);
      } catch {
        setError('로드 실패');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [streamerId]);

  if (loading) {
    return (
      <div style={{
        padding: 'var(--sp-3)',
        background: 'var(--surface-raise)',
        borderRadius: 'var(--r-md)',
        marginTop: 'var(--sp-2)',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}>
        로딩 중...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{
        padding: 'var(--sp-3)',
        background: 'var(--surface-raise)',
        borderRadius: 'var(--r-md)',
        marginTop: 'var(--sp-2)',
        color: 'var(--text-alert)',
        fontSize: 14,
      }}>
        {error || '데이터 없음'}
      </div>
    );
  }

  const allMatches = detail.matches || [];
  // 최근 10경기만 표시 — 번호는 전체 통산 판수 기준 (오래된 경기가 낮은 번호)
  const startIdx = Math.max(0, allMatches.length - 10);
  const matches = allMatches.slice(startIdx);

  return (
    <div style={{
      padding: 'var(--sp-3)',
      background: 'var(--surface-raise)',
      borderRadius: 'var(--r-md)',
      marginTop: 'var(--sp-2)',
      overflow: 'auto',
    }}>
      <div style={{
        display: 'table',
        width: '100%',
        fontSize: isMobile ? 12 : 13,
        borderCollapse: 'collapse',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'table-header-group',
          fontWeight: 600,
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-line)',
          marginBottom: 'var(--sp-2)',
        }}>
          <div style={{
            display: 'table-row',
            lineHeight: '24px',
          }}>
            <div style={{ display: 'table-cell', width: 40, paddingRight: 8 }}>번</div>
            <div style={{ display: 'table-cell', width: isMobile ? 80 : 100, paddingRight: 8 }}>날짜</div>
            <div style={{ display: 'table-cell', width: 60, paddingRight: 8, textAlign: 'right' }}>우리팀</div>
            <div style={{ display: 'table-cell', width: 60, paddingRight: 8, textAlign: 'right' }}>상대팀</div>
            <div style={{ display: 'table-cell', width: 60, paddingRight: 8, textAlign: 'center' }}>기대률</div>
            <div style={{ display: 'table-cell', width: 40, paddingRight: 8, textAlign: 'center' }}>결과</div>
            <div style={{ display: 'table-cell', width: 50, paddingRight: 8, textAlign: 'right' }}>변화</div>
            <div style={{ display: 'table-cell', width: isMobile ? 60 : 70, textAlign: 'right' }}>Elo</div>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ display: 'table-row-group' }}>
          {matches.map((m, idx) => (
            <div
              key={m.matchId}
              style={{
                display: 'table-row',
                borderBottom: '1px solid var(--border-line)',
                lineHeight: '28px',
              }}
            >
              <div style={{ display: 'table-cell', paddingRight: 8, color: 'var(--text-muted)' }}>
                {startIdx + idx + 1}
              </div>
              <div style={{ display: 'table-cell', paddingRight: 8, fontFamily: 'var(--font-numeral)', color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(m.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
              </div>
              <div style={{ display: 'table-cell', paddingRight: 8, textAlign: 'right', fontFamily: 'var(--font-numeral)' }}>
                {Math.round(m.teamElo)}
              </div>
              <div style={{ display: 'table-cell', paddingRight: 8, textAlign: 'right', fontFamily: 'var(--font-numeral)' }}>
                {Math.round(m.oppTeamElo)}
              </div>
              <div style={{ display: 'table-cell', paddingRight: 8, textAlign: 'center', fontFamily: 'var(--font-numeral)' }}>
                {(m.expectedWinRate * 100).toFixed(0)}%
              </div>
              <div style={{
                display: 'table-cell', paddingRight: 8, textAlign: 'center', fontWeight: 600,
                color: m.actual === 1 ? 'var(--cheese-green)' : 'var(--text-alert)',
              }}>
                {m.actual === 1 ? 'W' : 'L'}
              </div>
              <div style={{
                display: 'table-cell', paddingRight: 8, textAlign: 'right', fontFamily: 'var(--font-numeral)',
                color: m.delta >= 0 ? 'var(--cheese-green)' : 'var(--text-alert)',
                fontWeight: 500,
              }}>
                {m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)}
              </div>
              <div style={{ display: 'table-cell', textAlign: 'right', fontFamily: 'var(--font-numeral)', fontWeight: 600 }}>
                {Math.round(m.eloAfter)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {matches.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--sp-3)' }}>
          경기 기록 없음
        </div>
      )}
    </div>
  );
}

// ── Elo 순위표 탭 콘텐츠 ───────────────────────────────────────
function EloTab({ stats, bp }: { stats: PlayerStats[]; bp: Bp }) {
  const [role, setRole] = useState('전체');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => stats
      .filter(p => role === '전체' || p.fineRole === role)
      .sort((a, b) => b.eloRating - a.eloRating),
    [stats, role],
  );

  const isMobile = bp === 'mobile';

  return (
    <div>
      <EloNotice />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FilterBar role={role} onRole={setRole} />
        </div>
        <div style={{ flexShrink: 0, height: 32, display: 'flex', alignItems: 'center' }}>
          <EloInfoButton />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {filtered.map((p, idx) => (
            <div key={p.streamerId}>
              <div
                onClick={() => setExpandedId(expandedId === p.streamerId ? null : p.streamerId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: isMobile ? 'var(--sp-2)' : 'var(--sp-3)',
                  padding: isMobile ? '6px var(--sp-2)' : '6px var(--sp-3)',
                  borderRadius: 'var(--r-md)', background: 'var(--surface-card)',
                  border: '1px solid var(--border-line)',
                  cursor: 'pointer',
                  transition: 'background var(--dur-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-raise)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-card)')}
              >
                {/* 순번 — 24px */}
                <div style={{ width: isMobile ? 20 : 24, textAlign: 'center', flexShrink: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: isMobile ? 11 : 12,
                    color: 'var(--text-muted)',
                  }}>
                    {idx + 1}
                  </span>
                </div>

                {/* Elo — 72px, 왼쪽 이동 */}
                <div style={{ width: isMobile ? 56 : 72, textAlign: 'center', flexShrink: 0, marginLeft: isMobile ? -8 : -12 }}>
                  <span style={{
                    fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: isMobile ? 18 : 24,
                    color: 'var(--cheese-green)',
                  }}>
                    {Math.round(p.eloRating || 1500)}
                  </span>
                </div>

                {/* 프사 — 48px, 클릭 시 개인 페이지 (행 펼침과 분리) */}
                <div style={{ width: isMobile ? 36 : 48, flexShrink: 0 }}>
                  <Link
                    href={`/streamers/${p.streamerId}`}
                    prefetch={false}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${p.streamerName} 프로필`}
                    style={{ display: 'block' }}
                  >
                    <HexAvatar
                      name={p.streamerName}
                      imageUrl={p.profileImageUrl}
                      ring="var(--hots-purple)"
                      ringWidth={2}
                      size={isMobile ? 36 : 48}
                    />
                  </Link>
                </div>

                {/* 이름 — 데스크톱 140px, 모바일은 남는 폭 차지 */}
                <div style={{ width: isMobile ? undefined : 140, flex: isMobile ? 1 : undefined, minWidth: 0, flexShrink: isMobile ? 1 : 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: isMobile ? 14 : 16,
                    color: 'var(--text-high)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block',
                  }}>
                    {p.streamerName}
                  </span>
                </div>

                {/* 포지션·선호 영웅 — 모바일에선 공간 부족으로 숨김 */}
                {!isMobile && (
                  <>
                    {/* 포지션 — 100px */}
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <span style={{
                        fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15,
                        color: 'var(--text-muted)',
                      }}>
                        {p.fineRole ?? '-'}
                      </span>
                    </div>

                    {/* 선호 영웅 3개 — 140px */}
                    <div style={{ width: 140, display: 'flex', gap: 5, flexShrink: 0 }}>
                      {p.heroStats.slice(0, 3).map((h) => (
                        <HexAvatar
                          key={h.hero}
                          name={h.hero}
                          imageUrl={heroImageUrl(h.hero)}
                          ring="var(--hots-purple)"
                          ringWidth={1.5}
                          size={36}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* 전적 — 100px */}
                <div style={{ width: isMobile ? 70 : 100, textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-numeral)', fontWeight: 600, fontSize: isMobile ? 13 : 15,
                    color: 'var(--text-high)',
                  }}>
                    {p.wins}W {p.losses}L
                  </span>
                </div>
              </div>

              {/* 펼쳐진 상세 정보 */}
              {expandedId === p.streamerId && (
                <EloDetailPanel streamerId={p.streamerId} isMobile={isMobile} />
              )}
            </div>
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
      width: isMobile ? 60 : 78, padding: 'var(--sp-2) 4px', borderRadius: 'var(--r-md)',
    }}>
      <HeroTile name={h.hero} ring={ring} size={isMobile ? 46 : 60} />
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FilterBar role={role} onRole={setRole} />
        </div>
        <div style={{ flexShrink: 0, height: 32, display: 'flex', alignItems: 'center' }}>
          <HeroTierInfoButton />
        </div>
      </div>
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
  const [mainTab, setMainTab] = useState<MainTab>('curation');
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
    <div style={{ paddingTop: 'var(--sp-7)' }}>
      {/* 상위 3대 탭 — 역할 필터와 시각적 계층 구분 */}
      <MainTabBar tab={mainTab} onTab={setMainTab} />

      {/* 탭 패널 */}
      {mainTab === 'auto' && <AutoTierTab stats={stats} bp={bp} />}
      {mainTab === 'elo' && <EloTab stats={stats} bp={bp} />}
      {mainTab === 'curation' && (
        <CurationTierTab streamers={streamers} matches={matches} />
      )}
      {mainTab === 'hero' && <HeroTierTab heroTiers={heroTiers} bp={bp} />}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
