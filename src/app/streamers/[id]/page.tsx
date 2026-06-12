import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getStreamers, getMatches, isFirebaseConfigured } from '@/lib/firestore';
import { DATA_SOURCE_COOKIE, parseDataSource, resolveUseMock } from '@/lib/data-source';
import { getStreamerProfile, getRecentMatches, kdaFor } from '@/lib/profile';
import { fineRoleAffinity, fineRoleOfHero } from '@/lib/heroes';
import { outcomeFor, heroOf, statOf } from '@/lib/match';
import { aggregateHeroStats } from '@/lib/hero-stats';
import { computeRelations } from '@/lib/relations';
import { mapWinRates } from '@/lib/map-stats';
import { INSUFFICIENT_DATA } from '@/lib/sample';
import { MOCK_STREAMERS } from '@/test/fixtures/streamers';
import { MOCK_MATCHES } from '@/test/fixtures/matches';
import { HexAvatar } from '@/components/hexagon-avatar';
import { LevelBadge } from '@/components/level-badge';
import { heroImageUrl } from '@/lib/hero-image';
import type { HeroAggregate } from '@/lib/hero-stats';
import type { SynergyStat, NemesisStat } from '@/lib/relations';
import type { MapWinRate } from '@/lib/map-stats';
import type { HeroStat, Match, Tier } from '@/lib/types';

// --- 색상 상수 ---
const TIER_COLOR: Record<Tier, string> = {
  S: 'var(--tier-s)',
  A: 'var(--tier-a)',
  B: 'var(--tier-b)',
  C: 'var(--tier-c)',
  D: 'var(--tier-d)',
  unranked: 'var(--text-faint)',
};
const TIER_LABEL: Record<Tier, string> = {
  S: 'S', A: 'A', B: 'B', C: 'C', D: 'D', unranked: '?',
};

// --- 헬퍼 ---
function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function heroTotal(h: HeroStat): number { return h.wins + h.losses; }
function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}
function kdaOfMatch(m: Match, streamerId: string): string | null {
  const s = statOf(m, streamerId);
  if (!s) return null;
  return `${s.kills} / ${s.deaths} / ${s.assists}`;
}
function fmtNum(n: number | null): string {
  if (n === null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// --- 하위 컴포넌트 ---
function SectionHead({ ko, en, right }: { ko: string; en: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--sp-4)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
        color: 'var(--text-strong)', margin: 0 }}>
        {ko}
      </h2>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10.5, letterSpacing: '0.1em',
        color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        {en}
      </span>
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

function TierBadge({ tier }: { tier: Tier }) {
  const c = TIER_COLOR[tier];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`,
      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
      color: c, lineHeight: 1,
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

function StatPill({ value, suffix, label, accent }: {
  value: string; suffix?: string; label: string; accent?: 'green' | 'blue';
}) {
  const color = accent === 'green' ? 'var(--win)' : accent === 'blue' ? 'var(--cheese-blue)' : 'var(--text-high)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 20,
        color, lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontSize: 13, fontWeight: 700 }}>{suffix}</span>}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10,
        color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

// 영웅 아바타 — 육각형 영웅 프로필 (보라 테두리). 영웅 사진 있으면 표시, 없으면 이니셜 폴백.
function HeroAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return <HexAvatar name={name} imageUrl={heroImageUrl(name)} ring="var(--hots-purple)" size={size} ringWidth={1.5} />;
}

// --- 탭 카운트 뱃지 ---
function TabCount({ n }: { n: number }) {
  return (
    <span style={{
      marginLeft: 6,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: 18, minWidth: 18, padding: '0 5px', borderRadius: 999,
      background: 'var(--surface-raise)',
      fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 10.5,
      color: 'var(--text-faint)',
    }}>
      {n}
    </span>
  );
}

// --- 탭 링크 ---
function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} style={{
      display: 'inline-flex', alignItems: 'center', height: 36,
      padding: '0 var(--sp-4)',
      borderRadius: 'var(--r-sm)',
      fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
      fontSize: 14,
      color: active ? 'var(--text-strong)' : 'var(--text-muted)',
      background: active ? 'var(--surface-raise)' : 'transparent',
      border: active ? '1px solid var(--border-faint)' : '1px solid transparent',
      textDecoration: 'none',
      transition: 'background 0.15s, color 0.15s',
    }}>
      {children}
    </a>
  );
}

// --- 영웅 스탯 표 ---
function HeroStatsTable({ rows }: { rows: HeroAggregate[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-ui)', margin: 0 }}>
        경기 기록이 없습니다.
      </p>
    );
  }

  // 테이블 헤더 컬럼 정의
  const cols: { label: string; sub?: string; align: 'left' | 'right' }[] = [
    { label: '영웅', align: 'left' },
    { label: '승률', sub: '(판수)', align: 'right' },
    { label: 'KDA', align: 'right' },
    { label: '영웅딜', align: 'right' },
    { label: '공성딜', align: 'right' },
    { label: '힐', align: 'right' },
    { label: '자가힐', align: 'right' },
    { label: '경험치', align: 'right' },
  ];

  const cellBase: React.CSSProperties = {
    padding: '0 var(--sp-3)',
    fontFamily: 'var(--font-numeral)',
    // 중요 스탯 — 크고 뚜렷하게
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-high)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-faint)' }}>
            {cols.map((c, i) => (
              <th key={i} style={{
                ...cellBase,
                textAlign: c.align,
                padding: 'var(--sp-2) var(--sp-3)',
                fontFamily: 'var(--font-numeral)',
                fontWeight: 600, fontSize: 11,
                color: 'var(--text-faint)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
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
                {/* 영웅 */}
                <td style={{ ...cellBase, textAlign: 'left', padding: 'var(--sp-3) var(--sp-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeroAvatar name={h.hero} size={30} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
                        color: 'var(--text-high)' }}>
                        {h.hero}
                      </span>
                      {!hasStats && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5,
                          color: 'var(--text-faint)' }}>
                          데이터 부족
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                {/* 승률(판수) */}
                <td style={{ ...cellBase, textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, color: winColor }}>{winRateStr}</span>
                  <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>({h.games})</span>
                </td>
                {/* KDA — 중요 정보 */}
                <td style={{ ...cellBase, textAlign: 'right', fontWeight: 700,
                  color: hasStats ? 'var(--text-high)' : 'var(--text-faint)' }}>
                  {h.avgKda !== null ? h.avgKda.toFixed(2) : '—'}
                </td>
                {/* 영웅딜 */}
                <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgHeroDmg)}</td>
                {/* 공성딜 */}
                <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgSiegeDmg)}</td>
                {/* 힐 */}
                <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgHealing)}</td>
                {/* 자가힐 */}
                <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgSelfHeal)}</td>
                {/* 경험치 */}
                <td style={{ ...cellBase, textAlign: 'right' }}>{fmtNum(h.avgXp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- 공통: 빈/데이터 부족 안내 (CONTEXT.md 데이터 부족) ---
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-ui)', margin: 0 }}>
      {children}
    </p>
  );
}

// --- 최근/전체 매치 공통 행 (#17 좌측바 스타일) ---
// 클릭 시 경기 상세 페이지(/matches/[id])로 이동.
function MatchRow({ m, streamerId }: { m: Match; streamerId: string }) {
  const win = outcomeFor(m, streamerId) === 'win';
  const hero = heroOf(m, streamerId) ?? '—';
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
      <span style={{
        width: 4, flexShrink: 0,
        background: win ? 'var(--cheese-blue)' : 'var(--loss)',
      }} />
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        gap: 'var(--sp-3)', padding: '0 var(--sp-3)',
      }}>
        <HeroAvatar name={hero} size={36} />
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
          color: 'var(--text-high)', minWidth: 72, whiteSpace: 'nowrap' }}>{hero}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 96 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
            color: 'var(--text-high)', whiteSpace: 'nowrap' }}>{m.map ?? '—'}</span>
        </div>
        {kdaStr && (
          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 15, fontWeight: 700,
            color: 'var(--text-high)', fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap', marginLeft: 'var(--sp-2)' }}>
            {kdaStr}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontFamily: 'var(--font-numeral)',
            fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {m.dur ? `${m.dur} · ` : ''}{fmtDate(m.date)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>›</span>
        </span>
      </div>
    </a>
  );
}

// --- 시너지/천적 목록 (#23) ---
function RelationList({ rows, tone }: {
  rows: { streamerId: string; streamerName: string; games: number; rate: number }[];
  tone: 'win' | 'loss';
}) {
  if (rows.length === 0) {
    return <EmptyHint>{INSUFFICIENT_DATA} — 3경기 이상 함께/맞서야 집계됩니다.</EmptyHint>;
  }
  const color = tone === 'win' ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {rows.map((r) => (
        <a key={r.streamerId} href={`/streamers/${r.streamerId}`} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
          textDecoration: 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5,
            color: 'var(--text-high)', flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.streamerName}
          </span>
          <div style={{ width: 64, height: 8, borderRadius: 999,
            background: 'var(--surface-raise)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.round(r.rate * 100)}%`, height: '100%',
              borderRadius: 999, background: color }} />
          </div>
          <span style={{ width: 64, textAlign: 'right', fontFamily: 'var(--font-numeral)',
            fontSize: 12, color, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {Math.round(r.rate * 100)}%
          </span>
          <span style={{ width: 30, textAlign: 'right', fontFamily: 'var(--font-numeral)',
            fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {r.games}판
          </span>
        </a>
      ))}
    </div>
  );
}

// --- 맵별 승률: 주요 맵 1행 (큰 막대) ---
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

// --- 맵별 승률: 축소 칩 (이름 + 승률%만) ---
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

// --- 맵별 승률 목록 (#24): 좌측 베스트 3(큰 막대) | 우측 나머지(열 우선 2열) ---
function MapWinRateList({ rows }: { rows: MapWinRate[] }) {
  if (rows.length === 0) {
    return <EmptyHint>맵 기록이 있는 경기가 없습니다.</EmptyHint>;
  }
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  // 나머지를 2열로 채우되 첫째 열을 위→아래로 다 채운 뒤 둘째 열로 (열 우선).
  // grid-auto-flow: column + 행 수 고정으로 열 우선 배치를 구현.
  const restRows = Math.max(1, Math.ceil(rest.length / 2));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
      {/* 좌측: 베스트 3 — 막대로 크게 */}
      <div style={{ flex: '1 1 340px', minWidth: 300,
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {top.map((r) => <MapWinRateRowMain key={r.map} r={r} />)}
      </div>
      {/* 우측: 나머지 맵 — 승률 순으로 첫째 열 → 둘째 열 (열 우선) */}
      {rest.length > 0 && (
        <div style={{
          flex: '1 1 300px', minWidth: 280,
          display: 'grid',
          gridTemplateRows: `repeat(${restRows}, auto)`,
          gridAutoFlow: 'column',
          gridAutoColumns: '1fr',
          rowGap: 'var(--sp-2)', columnGap: 'var(--sp-5)',
          paddingLeft: 'var(--sp-6)', borderLeft: '1px solid var(--border-faint)',
        }}>
          {rest.map((r) => <MapWinRateChip key={r.map} r={r} />)}
        </div>
      )}
    </div>
  );
}

// --- 메인 페이지 ---
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  // 탭 상태: 'overview'(기본) · 'heroes' · 'matches'(전체 매치)
  const activeTab: 'overview' | 'heroes' | 'matches' =
    tab === 'heroes' ? 'heroes' : tab === 'matches' ? 'matches' : 'overview';

  const override = parseDataSource((await cookies()).get(DATA_SOURCE_COOKIE)?.value);
  const useMock = resolveUseMock(override, isFirebaseConfigured);
  const [streamers, matches] = useMock
    ? [MOCK_STREAMERS, MOCK_MATCHES]
    : await Promise.all([getStreamers(), getMatches()]);

  const profile = getStreamerProfile(id, streamers, matches);
  if (!profile) notFound();

  const streamer = streamers.find(s => s.id === id)!;
  const kda      = kdaFor(matches, id);
  const affinity = fineRoleAffinity(matches, id);
  const maxAff   = affinity.length > 0 ? affinity[0].games : 1;
  const recent   = getRecentMatches(id, matches, 6);
  const allMatches = getRecentMatches(id, matches, Infinity);
  const top3     = profile.heroStats.slice(0, 3);
  const rest     = profile.heroStats.slice(3, 10);
  const tc       = TIER_COLOR[profile.tier];

  // 영웅 탭용 집계
  const heroAggregates = aggregateHeroStats(id, matches);

  // 개요 탭: 시너지/천적(#23), 맵별 승률(#24)
  const { synergy, nemesis } = computeRelations(id, streamers, matches);
  const maps = mapWinRates(id, matches);
  const TOP_N = 5;

  // 탭 링크 URL 생성
  const overviewHref = `?tab=overview`;
  const heroesHref   = `?tab=heroes`;
  const matchesHref  = `?tab=matches`;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '310px 1fr', gap: 'var(--sp-5)',
      alignItems: 'start',
      padding: 'var(--sp-7) 0 var(--sp-20)',
    }}>
      {/* ── 사이드바 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
        position: 'sticky', top: 88 }}>

        {/* 프로필 카드 (글로우) */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: `1px solid ${profile.tier === 'S' ? 'var(--border-glow)' : 'var(--border-line)'}`,
          boxShadow: profile.tier === 'S' ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
          padding: 'var(--sp-6)', textAlign: 'center',
        }}>
          {/* 아바타 104 — 육각형, 티어색 테두리 */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HexAvatar
              name={streamer.name}
              imageUrl={streamer.profileImageUrl}
              ring={tc}
              size={104}
            />
          </div>

          {/* 이름 + 티어 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 'var(--sp-4)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
              color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
              {streamer.name}
            </span>
            <TierBadge tier={profile.tier} />
          </div>

          {/* 배틀넷 닉네임 — 이름 아래 흐릿하게 */}
          {streamer.gameNames && streamer.gameNames.length > 0 && (
            <div style={{ marginTop: 4, fontFamily: 'var(--font-numeral)', fontSize: 12,
              color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' }}>
              {streamer.gameNames.join(' · ')}
            </div>
          )}

          {/* 계정레벨 — 주요 정보로 강조 (레벨 기반 색상 캡슐) */}
          {streamer.accountLevel != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, marginTop: 8 }}>
              <LevelBadge level={streamer.accountLevel} />
            </div>
          )}

          {/* 메인 롤 — 세분(암살자 원거리/근접 구별) */}
          {affinity[0] && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                {affinity[0].role} 메인
              </span>
            </div>
          )}

          {/* 스탯 필 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-6)',
            marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-5)',
            borderTop: '1px solid var(--border-faint)' }}>
            <StatPill value={String(Math.round(profile.winRate * 100))} suffix="%"
              label="WIN RATE" accent="green" />
            <StatPill value={kda != null ? kda.toFixed(2) : '—'} label="KDA" accent="blue" />
            <StatPill value={String(profile.totalGames)} label="총 경기" />
          </div>

          {/* 승률 바 */}
          <div style={{ marginTop: 'var(--sp-5)' }}>
            <WinRateBar wins={profile.wins} total={profile.totalGames} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11, color: 'var(--win)' }}>
                {profile.wins}W
              </span>
              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11, color: 'var(--loss)' }}>
                {profile.losses}L
              </span>
            </div>
          </div>

        </div>

        {/* 선호 포지션 */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        }}>
          <SectionHead ko="선호 포지션" en="Role affinity" />
          {affinity.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 12.5, fontFamily: 'var(--font-ui)', margin: 0 }}>
              집계할 기록이 없습니다.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {affinity.map((r, i) => (
                  <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <span style={{ width: 46, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                      color: i === 0 ? 'var(--text-high)' : 'var(--text-muted)' }}>
                      {r.role}
                    </span>
                    <div style={{ flex: 1, height: 12, borderRadius: 999,
                      background: 'var(--surface-raise)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(r.games / maxAff) * 100}%`, height: '100%', borderRadius: 999,
                        background: i === 0 ? 'var(--cheese-green)' : 'var(--text-muted)',
                        boxShadow: i === 0 ? 'var(--glow-green-soft)' : 'none',
                      }} />
                    </div>
                    <span style={{ width: 70, textAlign: 'right', fontFamily: 'var(--font-numeral)',
                      fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {r.pct}% · {r.games}판
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)',
                borderTop: '1px solid var(--border-faint)',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--cheese-green)', boxShadow: '0 0 8px var(--cheese-green)' }} />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
                  주 포지션 <b style={{ color: 'var(--text-high)' }}>{affinity[0].role}</b>
                  {' '}· 전체 판수의 {affinity[0].pct}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 메인 피드 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* 탭 바 */}
        <div style={{
          display: 'flex', gap: 'var(--sp-2)',
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)',
          padding: 'var(--sp-2)',
        }}>
          <TabLink href={overviewHref} active={activeTab === 'overview'}>개요</TabLink>
          <TabLink href={heroesHref}   active={activeTab === 'heroes'}>
            영웅
            <TabCount n={heroAggregates.length} />
          </TabLink>
          <TabLink href={matchesHref}  active={activeTab === 'matches'}>
            전체 매치
            <TabCount n={allMatches.length} />
          </TabLink>
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
                  color: 'var(--text-faint)' }}>{profile.heroStats.length} 영웅</span>} />

              {profile.heroStats.length === 0 ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-ui)', margin: 0 }}>
                  경기 기록이 없습니다.
                </p>
              ) : (
                <>
                  {/* 상위 3 카드 */}
                  <div style={{ display: 'grid',
                    gridTemplateColumns: `repeat(${Math.max(top3.length, 1)}, 1fr)`,
                    gap: 'var(--sp-4)' }}>
                    {top3.map((h, i) => {
                      const total = heroTotal(h);
                      const role = fineRoleOfHero(h.hero);
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
                              {total > 0 ? pct(h.wins / total) : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 나머지 행 */}
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
                              {total}판 · {total > 0 ? pct(h.wins / total) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 맵별 승률 (#24) */}
            <div style={{
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            }}>
              <SectionHead ko="맵별 승률" en="Map win rate"
                right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                  color: 'var(--text-faint)' }}>맵당 최소 3경기</span>} />
              <MapWinRateList rows={maps} />
            </div>

            {/* 시너지 팀원 / 천적 (#23) */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)',
            }}>
              <div style={{
                background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
              }}>
                <SectionHead ko="시너지 팀원" en="Synergy" />
                <RelationList
                  tone="win"
                  rows={synergy.slice(0, TOP_N).map((s: SynergyStat) => ({
                    streamerId: s.streamerId, streamerName: s.streamerName,
                    games: s.games, rate: s.winRate,
                  }))}
                />
              </div>
              <div style={{
                background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
              }}>
                <SectionHead ko="천적" en="Nemesis" />
                <RelationList
                  tone="loss"
                  rows={nemesis.slice(0, TOP_N).map((n: NemesisStat) => ({
                    streamerId: n.streamerId, streamerName: n.streamerName,
                    games: n.games, rate: n.lossRate,
                  }))}
                />
              </div>
            </div>

            {/* 최근 매치 — 전체는 별도 '전체 매치' 탭으로 (#22) */}
            <div style={{
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            }}>
              <SectionHead
                ko="최근 매치"
                en="Recent matches"
                right={
                  allMatches.length > recent.length ? (
                    <a href={matchesHref} style={{
                      fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
                      color: 'var(--cheese-green)', textDecoration: 'none',
                    }}>
                      전체 매치 ({allMatches.length}) ›
                    </a>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                      color: 'var(--text-faint)' }}>{recent.length}경기</span>
                  )
                }
              />

              {recent.length === 0 ? (
                <EmptyHint>경기 기록이 없습니다.</EmptyHint>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recent.map(m => (
                    <MatchRow key={m.id} m={m} streamerId={id} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 전체 매치 탭 (#22) ── */}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allMatches.map(m => (
                  <MatchRow key={m.id} m={m} streamerId={id} />
                ))}
              </div>
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
              right={
                <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12, color: 'var(--text-faint)' }}>
                  판수 내림차순
                </span>
              }
            />
            <HeroStatsTable rows={heroAggregates} />
          </div>
        )}
      </div>
    </div>
  );
}
