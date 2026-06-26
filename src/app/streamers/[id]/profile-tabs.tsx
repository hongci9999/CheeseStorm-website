'use client';

import { useState, useEffect } from 'react';
import { HexAvatar } from '@/components/hexagon-avatar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { heroImageUrl } from '@/lib/hero-image';
import { outcomeFor, heroOf, statOf } from '@/lib/match';
import { fineRoleOfHero } from '@/lib/heroes';
import { INSUFFICIENT_DATA } from '@/lib/sample';
import type { HeroAggregate } from '@/lib/hero-stats';
import type { MapWinRate } from '@/lib/map-stats';
import type { HeroStat, Match, PlayerMatchStat } from '@/lib/types';

// Match에서 Date 필드를 string으로 직렬화한 타입 (서버→클라이언트 경계)
export type SerializedMatch = Omit<Match, 'date' | 'createdAt'> & {
  date: string;
  createdAt: string;
};

export type RelationRow = {
  streamerId: string;
  streamerName: string;
  games: number;
  rate: number;
};

export type StreamerBasic = {
  id: string;
  name: string;
  profileImageUrl?: string;
};

export interface ProfileTabsProps {
  streamerId: string;
  initialTab: 'overview' | 'heroes' | 'matches';
  heroStats: HeroStat[];
  heroAggregates: HeroAggregate[];
  recentMatches: SerializedMatch[];
  allMatches: SerializedMatch[];
  synergy: RelationRow[];
  nemesis: RelationRow[];
  maps: MapWinRate[];
  streamers: StreamerBasic[];
}

// ── 공통 유틸 ─────────────────────────────────────────────────
function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function heroTotal(h: HeroStat): number { return h.wins + h.losses; }
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}
function fmtNum(n: number | null): string {
  if (n === null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function kdaOfMatch(m: SerializedMatch, streamerId: string): string | null {
  const s = statOf(m as unknown as Match, streamerId);
  if (!s) return null;
  return `${s.kills} / ${s.assists} / ${s.deaths}`;
}

// ── 공유 컴포넌트 ──────────────────────────────────────────────
function SectionHead({ ko, en, right }: { ko: string; en: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--sp-4)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
        color: 'var(--text-strong)', margin: 0 }}>{ko}</h2>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10.5, letterSpacing: '0.1em',
        color: 'var(--text-faint)', textTransform: 'uppercase' }}>{en}</span>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}

function WinRateBar({ wins, total, height = 8 }: { wins: number; total: number; height?: number }) {
  const w = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div style={{ height, borderRadius: 999, background: 'var(--loss-soft)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 999, width: `${w}%`, background: 'var(--win)' }} />
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-ui)', margin: 0 }}>
      {children}
    </p>
  );
}

function HeroAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return <HexAvatar name={name} imageUrl={heroImageUrl(name)} ring="var(--hots-purple)" size={size} ringWidth={1.5} />;
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 13,
        color: 'var(--text-high)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 9.5, letterSpacing: '0.07em',
        color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function TabCount({ n }: { n: number }) {
  return (
    <span style={{
      marginLeft: 6,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: 18, minWidth: 18, padding: '0 5px', borderRadius: 999,
      background: 'var(--surface-raise)',
      fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 10.5,
      color: 'var(--text-faint)',
    }}>{n}</span>
  );
}

// ── 탭 버튼 (클릭 = 상태 변경, URL replaceState) ──────────────
function TabBtn({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', height: 36,
        padding: '0 var(--sp-4)',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
        fontSize: 14,
        color: active ? 'var(--text-strong)' : 'var(--text-muted)',
        background: active ? 'var(--surface-raise)' : 'transparent',
        border: active ? '1px solid var(--border-faint)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── 매치 행 ───────────────────────────────────────────────────
function MatchRow({ m, streamerId, isMobile }: { m: SerializedMatch; streamerId: string; isMobile: boolean }) {
  const win = outcomeFor(m as unknown as Match, streamerId) === 'win';
  const hero = heroOf(m as unknown as Match, streamerId) ?? '—';
  const kdaStr = kdaOfMatch(m, streamerId);
  return (
    <a href={`/matches/${m.id}`} style={{
      display: 'flex', alignItems: 'stretch',
      borderRadius: 'var(--r-sm)',
      background: win
        ? 'color-mix(in srgb, var(--cheese-blue) 14%, var(--surface-raise))'
        : 'color-mix(in srgb, var(--loss) 14%, var(--surface-raise))',
      overflow: 'hidden',
      minHeight: 50,
      textDecoration: 'none',
    }}>
      <span style={{ width: 4, flexShrink: 0, background: win ? 'var(--cheese-blue)' : 'var(--loss)' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center',
        gap: 'var(--sp-3)', padding: '0 var(--sp-3)' }}>
        <HeroAvatar name={hero} size={36} />
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
          color: 'var(--text-high)', minWidth: isMobile ? 0 : 72, flexShrink: 0,
          whiteSpace: 'nowrap' }}>{hero}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1,
          minWidth: isMobile ? 0 : 96, flex: isMobile ? 1 : undefined }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
            color: 'var(--text-high)', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.map ?? '—'}</span>
        </div>
        {kdaStr && (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0,
            marginLeft: isMobile ? 'auto' : 'var(--sp-2)', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 9.5,
              letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              K/A/D
            </span>
            <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 15, fontWeight: 700,
              color: 'var(--text-high)', fontVariantNumeric: 'tabular-nums' }}>
              {kdaStr}
            </span>
          </span>
        )}
        {/* 모바일은 가로폭에 맞춰 KDA까지만 표시 (시간·날짜 숨김) */}
        {!isMobile && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ fontFamily: 'var(--font-numeral)',
              fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
              {m.dur ? `${m.dur} · ` : ''}{fmtDate(m.date)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>›</span>
          </span>
        )}
      </div>
    </a>
  );
}

// ── 영웅 스탯 테이블 ──────────────────────────────────────────
function HeroStatsTable({ rows, isMobile }: { rows: HeroAggregate[]; isMobile: boolean }) {
  if (rows.length === 0) {
    return <EmptyHint>경기 기록이 없습니다.</EmptyHint>;
  }
  const allCols: { label: string; sub?: string; align: 'left' | 'right' }[] = [
    { label: '영웅', align: 'left' },
    { label: '승률', sub: '(전적)', align: 'right' },
    { label: 'KDA', align: 'right' },
    { label: '영웅딜', align: 'right' },
    { label: '공성딜', align: 'right' },
    { label: '힐', align: 'right' },
    { label: '자가힐', align: 'right' },
    { label: '경험치', align: 'right' },
  ];
  // 모바일은 가로폭에 맞춰 영웅·승률만 표시 (스탯 컬럼 숨김)
  const cols = isMobile ? allCols.slice(0, 2) : allCols;
  const cellBase: React.CSSProperties = {
    padding: 'var(--sp-2) var(--sp-3)',
    fontFamily: 'var(--font-numeral)',
    fontSize: 14, fontWeight: 600,
    color: 'var(--text-high)',
    whiteSpace: 'nowrap', verticalAlign: 'middle',
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? undefined : 620 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-faint)' }}>
            {cols.map((c, i) => (
              <th key={i} style={{
                ...cellBase, textAlign: c.align,
                padding: 'var(--sp-2) var(--sp-3)',
                fontWeight: 600, fontSize: 11,
                color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {c.label}{c.sub && <span style={{ fontWeight: 400 }}> {c.sub}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => {
            const winRateStr = h.winRate !== null ? pct(h.winRate) : '—';
            const winColor = h.winRate !== null && h.winRate >= 0.5 ? 'var(--win)' : 'var(--loss)';
            const hasStats = h.statGames > 0;
            return (
              <tr key={h.hero} style={{
                borderBottom: '1px solid var(--border-faint)',
                background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--surface-raise) 40%, transparent)',
              }}>
                <td style={{ ...cellBase, textAlign: 'left', padding: 'var(--sp-3) var(--sp-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeroAvatar name={h.hero} size={30} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
                        color: 'var(--text-high)' }}>{h.hero}</span>
                      {!hasStats && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5,
                          color: 'var(--text-faint)' }}>데이터 부족</span>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ ...cellBase, textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, color: winColor }}>{winRateStr}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>
                    {h.wins}승 {h.losses}패
                  </span>
                </td>
                {!isMobile && (
                  <>
                    <td style={{ ...cellBase, textAlign: 'right', fontWeight: 700,
                      color: hasStats ? 'var(--text-high)' : 'var(--text-faint)' }}>
                      {h.avgKda !== null ? h.avgKda.toFixed(2) : '—'}
                    </td>
                    <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgHeroDmg)}</td>
                    <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgSiegeDmg)}</td>
                    <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgHealing)}</td>
                    <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgSelfHeal)}</td>
                    <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgXp)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 시너지/천적 목록 ──────────────────────────────────────────
function RelationList({ rows, tone, streamers }: {
  rows: RelationRow[];
  tone: 'win' | 'loss';
  streamers: StreamerBasic[];
}) {
  if (rows.length === 0) {
    return <EmptyHint>{INSUFFICIENT_DATA} — 3경기 이상 함께/맞서야 집계됩니다.</EmptyHint>;
  }
  const color = tone === 'win' ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {rows.map((r) => {
        const s = streamers.find(x => x.id === r.streamerId);
        return (
          <a key={r.streamerId} href={`/streamers/${r.streamerId}`} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
            textDecoration: 'none', padding: '4px 0',
          }}>
            <HexAvatar name={r.streamerName} imageUrl={s?.profileImageUrl} ring={color} size={32} ringWidth={1.5} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5,
                color: 'var(--text-high)', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.streamerName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 999,
                  background: 'var(--surface-raise)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(r.rate * 100)}%`, height: '100%',
                    borderRadius: 999, background: color }} />
                </div>
                <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                  color, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {Math.round(r.rate * 100)}%
                </span>
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 20, padding: '0 7px', borderRadius: 'var(--r-pill)',
              background: `color-mix(in srgb, ${color} 12%, var(--surface-raise))`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
              color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {r.games}판
            </span>
          </a>
        );
      })}
    </div>
  );
}

// ── 맵별 승률 ─────────────────────────────────────────────────
function MapWinRateRowMain({ r }: { r: MapWinRate }) {
  const enough = r.winRate !== null;
  const winColor = enough && r.winRate! >= 0.5 ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <span style={{ width: 110, fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14.5,
        color: enough ? 'var(--text-high)' : 'var(--text-faint)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.map}
      </span>
      <div style={{ flex: 1, height: 10, borderRadius: 999,
        background: 'var(--surface-raise)', overflow: 'hidden' }}>
        {enough && (
          <div style={{ width: `${Math.round(r.winRate! * 100)}%`, height: '100%',
            borderRadius: 999, background: winColor }} />
        )}
      </div>
      <span style={{ width: 120, textAlign: 'right', fontFamily: 'var(--font-numeral)',
        fontSize: 13, whiteSpace: 'nowrap',
        color: enough ? winColor : 'var(--text-faint)', fontWeight: enough ? 800 : 400 }}>
        {enough
          ? `${Math.round(r.winRate! * 100)}% · ${r.wins}승 ${r.losses}패`
          : `${INSUFFICIENT_DATA} (${r.games}판)`}
      </span>
    </div>
  );
}

function MapWinRateChip({ r }: { r: MapWinRate }) {
  const enough = r.winRate !== null;
  const winColor = enough && r.winRate! >= 0.5 ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
      <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 12,
        color: enough ? 'var(--text-muted)' : 'var(--text-faint)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.map}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5, whiteSpace: 'nowrap',
        color: enough ? winColor : 'var(--text-faint)', fontWeight: enough ? 700 : 400 }}>
        {enough
          ? `${Math.round(r.winRate! * 100)}% · ${r.wins}승 ${r.losses}패`
          : `${r.games}판`}
      </span>
    </div>
  );
}

function MapWinRateList({ rows }: { rows: MapWinRate[] }) {
  if (rows.length === 0) return <EmptyHint>맵 기록이 있는 경기가 없습니다.</EmptyHint>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const restRows = Math.max(1, Math.ceil(rest.length / 2));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 340px', minWidth: 300,
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {top.map((r) => <MapWinRateRowMain key={r.map} r={r} />)}
      </div>
      {rest.length > 0 && (
        <div style={{
          flex: '1 1 300px', minWidth: 280,
          display: 'grid',
          gridTemplateRows: `repeat(${restRows}, auto)`,
          gridAutoFlow: 'column', gridAutoColumns: '1fr',
          rowGap: 'var(--sp-2)', columnGap: 'var(--sp-5)',
          paddingLeft: 'var(--sp-6)', borderLeft: '1px solid var(--border-faint)',
        }}>
          {rest.map((r) => <MapWinRateChip key={r.map} r={r} />)}
        </div>
      )}
    </div>
  );
}

// ── 메인 클라이언트 컴포넌트 ──────────────────────────────────
const MATCHES_PAGE = 10;

export function ProfileTabs({
  streamerId, initialTab, heroStats, heroAggregates,
  recentMatches, allMatches, synergy, nemesis, maps, streamers,
}: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'heroes' | 'matches'>(initialTab);
  const [visibleCount, setVisibleCount] = useState(MATCHES_PAGE);
  const isMobile = useBreakpoint() === 'mobile';

  // URL의 ?tab= 파라미터를 탭 전환 시 동기화 (페이지 리로드 없이)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    history.replaceState(null, '', `?${params.toString()}`);
  }, [activeTab]);

  const top3 = heroStats.slice(0, 3);
  const rest = heroStats.slice(3, 5);
  const TOP_N = 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {/* 탭 바 */}
      <div style={{
        display: 'flex', gap: 'var(--sp-2)',
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)',
        padding: 'var(--sp-2)',
      }}>
        <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>개요</TabBtn>
        <TabBtn active={activeTab === 'heroes'} onClick={() => setActiveTab('heroes')}>
          영웅<TabCount n={heroAggregates.length} />
        </TabBtn>
        <TabBtn active={activeTab === 'matches'} onClick={() => setActiveTab('matches')}>
          전체 매치<TabCount n={allMatches.length} />
        </TabBtn>
      </div>

      {/* ── 개요 탭 ── */}
      {activeTab === 'overview' && (
        <>
          {/* 선호 캐릭터 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
          }}>
            <SectionHead ko="선호 캐릭터" en="Most played heroes"
              right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                color: 'var(--text-faint)' }}>{heroStats.length} 영웅</span>} />
            {heroStats.length === 0 ? (
              <EmptyHint>경기 기록이 없습니다.</EmptyHint>
            ) : (
              <>
                <div style={{ display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.max(top3.length, 1)}, 1fr)`,
                  gap: 'var(--sp-4)' }}>
                  {top3.map((h, i) => {
                    const total = heroTotal(h);
                    const role = fineRoleOfHero(h.hero);
                    const agg = heroAggregates.find(a => a.hero === h.hero);
                    const hasStats = agg && agg.statGames > 0;
                    return (
                      <div key={h.hero} style={{
                        background: 'var(--surface-raise)', borderRadius: 'var(--r-md)',
                        border: '1px solid var(--border-faint)', padding: 'var(--sp-4)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                          marginBottom: 'var(--sp-4)' }}>
                          <HeroAvatar name={h.hero} size={48} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
                              color: 'var(--text-strong)', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {h.hero}
                            </span>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12,
                              color: 'var(--text-faint)' }}>
                              {total}판{role ? ` · ${role}` : ''}
                            </span>
                          </div>
                          {i === 0 && (
                            <span style={{
                              marginLeft: 'auto', flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px',
                              borderRadius: 'var(--r-xs)', background: 'var(--win-soft)',
                              color: 'var(--win)', fontFamily: 'var(--font-numeral)',
                              fontWeight: 700, fontSize: 10.5,
                            }}>주력</span>
                          )}
                        </div>
                        <WinRateBar wins={h.wins} total={total} height={7} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
                            color: 'var(--text-faint)' }}>{h.wins}W {h.losses}L</span>
                          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11.5,
                            color: total > 0 && h.wins / total >= 0.5 ? 'var(--win)' : 'var(--loss)' }}>
                            {total > 0 ? `${Math.round((h.wins / total) * 100)}%` : '—'}
                          </span>
                        </div>
                        {/* 평균 스탯 — 모바일은 승률만 보이도록 숨김 */}
                        {isMobile ? null : hasStats ? (
                          <div style={{ marginTop: 'var(--sp-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-2)' }}>
                              <div style={{ flex: 1, height: 1, background: 'var(--border-faint)' }} />
                              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 9, letterSpacing: '0.12em',
                                color: 'var(--text-faint)', textTransform: 'uppercase' }}>avg</span>
                            </div>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 'var(--sp-2)',
                          }}>
                            <StatMini label="KDA" value={agg.avgKda?.toFixed(2) ?? '—'} />
                            <StatMini label="영웅딜" value={fmtNum(agg.avgHeroDmg)} />
                            <StatMini label="공성딜" value={fmtNum(agg.avgSiegeDmg)} />
                            <StatMini label="힐" value={fmtNum(agg.avgHealing)} />
                            <StatMini label="자가힐" value={fmtNum(agg.avgSelfHeal)} />
                            <StatMini label="경험치" value={fmtNum(agg.avgXp)} />
                          </div>
                          </div>
                        ) : (
                          <p style={{
                            marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)',
                            borderTop: '1px solid var(--border-faint)',
                            fontFamily: 'var(--font-ui)', fontSize: 11,
                            color: 'var(--text-faint)', textAlign: 'center',
                          }}>
                            스탯 데이터 없음
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {rest.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8,
                    marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)',
                    borderTop: '1px solid var(--border-faint)' }}>
                    {rest.map((h, i) => {
                      const total = heroTotal(h);
                      return (
                        <div key={h.hero} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                            color: 'var(--text-faint)', width: 16 }}>{i + 4}</span>
                          <HeroAvatar name={h.hero} size={34} />
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                            color: 'var(--text-high)', width: 88, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.hero}
                          </span>
                          <div style={{ flex: 1 }}>
                            <WinRateBar wins={h.wins} total={total} height={6} />
                          </div>
                          <span style={{ width: 70, textAlign: 'right', fontFamily: 'var(--font-numeral)',
                            fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {total}판 · {total > 0 ? `${Math.round((h.wins / total) * 100)}%` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 맵별 승률 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
          }}>
            <SectionHead ko="맵별 승률" en="Map win rate"
              right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                color: 'var(--text-faint)' }}>맵당 최소 3경기</span>} />
            <MapWinRateList rows={maps} />
          </div>

          {/* 시너지 / 천적 */}
          <div style={{ display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--sp-5)' }}>
            <div style={{
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            }}>
              <SectionHead ko="시너지 팀원" en="Synergy" />
              <RelationList tone="win" streamers={streamers} rows={synergy.slice(0, TOP_N)} />
            </div>
            <div style={{
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            }}>
              <SectionHead ko="천적" en="Nemesis" />
              <RelationList tone="loss" streamers={streamers} rows={nemesis.slice(0, TOP_N)} />
            </div>
          </div>

          {/* 최근 매치 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
          }}>
            <SectionHead
              ko="최근 매치" en="Recent matches"
              right={
                allMatches.length > recentMatches.length ? (
                  <button
                    onClick={() => setActiveTab('matches')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
                      color: 'var(--cheese-green)',
                    }}
                  >
                    전체 매치 ({allMatches.length}) ›
                  </button>
                ) : (
                  <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                    color: 'var(--text-faint)' }}>{recentMatches.length}경기</span>
                )
              }
            />
            {recentMatches.length === 0 ? (
              <EmptyHint>경기 기록이 없습니다.</EmptyHint>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentMatches.map(m => <MatchRow key={m.id} m={m} streamerId={streamerId} isMobile={isMobile} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 전체 매치 탭 ── */}
      {activeTab === 'matches' && (
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        }}>
          <SectionHead ko="전체 매치" en="All matches"
            right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
              color: 'var(--text-faint)' }}>{allMatches.length}경기 · 최신순</span>} />
          {allMatches.length === 0 ? (
            <EmptyHint>경기 기록이 없습니다.</EmptyHint>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allMatches.slice(0, visibleCount).map(m => (
                  <MatchRow key={m.id} m={m} streamerId={streamerId} isMobile={isMobile} />
                ))}
              </div>
              {visibleCount < allMatches.length && (
                <button
                  onClick={() => setVisibleCount(c => c + MATCHES_PAGE)}
                  style={{
                    marginTop: 'var(--sp-4)', width: '100%', height: 44,
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
                    background: 'transparent', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                    color: 'var(--text-muted)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface-raise)';
                    e.currentTarget.style.color = 'var(--text-high)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  더 보기 ({allMatches.length - visibleCount}경기 남음)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 영웅 탭 ── */}
      {activeTab === 'heroes' && (
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        }}>
          <SectionHead ko="영웅 전체 스탯" en="All hero stats"
            right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
              color: 'var(--text-faint)' }}>판수 내림차순</span>} />
          <HeroStatsTable rows={heroAggregates} isMobile={isMobile} />
        </div>
      )}
    </div>
  );
}
