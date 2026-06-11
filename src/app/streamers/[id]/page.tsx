import { notFound } from 'next/navigation';
import { getStreamers, getMatches, isFirebaseConfigured } from '@/lib/firestore';
import { getStreamerProfile, getRecentMatches } from '@/lib/profile';
import { outcomeFor, heroOf } from '@/lib/match';
import { MOCK_STREAMERS } from '@/test/fixtures/streamers';
import { MOCK_MATCHES } from '@/test/fixtures/matches';
import type { HeroStat, Match, PlayerStats, Tier } from '@/lib/types';

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

// --- 하위 컴포넌트 ---
function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const w = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--loss-soft)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${w}%`,
        background: 'var(--win)',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const c = TIER_COLOR[tier];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`,
      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
      color: c, lineHeight: 1,
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      flex: 1, padding: 'var(--sp-3) 0',
      background: 'var(--surface-raise)', borderRadius: 'var(--r-sm)',
      border: '1px solid var(--border-faint)',
    }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 17,
        color: 'var(--text-high)' }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10,
        color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function HeroCard({ h, rank }: { h: HeroStat; rank?: boolean }) {
  const total = heroTotal(h);
  const wr = total > 0 ? h.wins / total : 0;
  const c = wr >= 0.6 ? 'var(--win)' : wr < 0.4 ? 'var(--loss)' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)',
      background: rank ? 'var(--surface-raise)' : 'transparent',
      borderRadius: rank ? 'var(--r-sm)' : 0,
      border: rank ? '1px solid var(--border-faint)' : 'none',
      borderBottom: !rank ? '1px solid var(--border-faint)' : undefined,
    }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
        color: 'var(--text-high)', flex: 1 }}>
        {h.hero}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
        color: 'var(--text-faint)', minWidth: 36, textAlign: 'right' }}>
        {total}경기
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 13,
        color: c, minWidth: 36, textAlign: 'right' }}>
        {pct(wr)}
      </span>
    </div>
  );
}

function MatchRow({ m, streamerId }: { m: Match; streamerId: string }) {
  const hero = heroOf(m, streamerId) ?? '—';
  const win  = outcomeFor(m, streamerId) === 'win';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)',
      borderBottom: '1px solid var(--border-faint)',
    }}>
      {/* 승패 칩 */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 22, borderRadius: 'var(--r-xs)', flexShrink: 0,
        background: win ? 'var(--win-soft)' : 'var(--loss-soft)',
        color: win ? 'var(--win)' : 'var(--loss)',
        fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
      }}>
        {win ? 'WIN' : 'LOSE'}
      </span>
      {/* 영웅 */}
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
        color: 'var(--text-high)', flex: 1 }}>
        {hero}
      </span>
      {/* 맵 */}
      {m.map && (
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12,
          color: 'var(--text-faint)' }}>
          {m.map}
        </span>
      )}
      {/* 경기 시간 */}
      {m.dur && (
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
          color: 'var(--text-faint)', minWidth: 40, textAlign: 'right' }}>
          {m.dur}
        </span>
      )}
      {/* 날짜 */}
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
        color: 'var(--text-faint)', minWidth: 28, textAlign: 'right' }}>
        {fmtDate(m.date)}
      </span>
    </div>
  );
}

// --- 메인 페이지 ---
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [streamers, matches] = isFirebaseConfigured
    ? await Promise.all([getStreamers(), getMatches()])
    : [MOCK_STREAMERS, MOCK_MATCHES];

  const profile = getStreamerProfile(id, streamers, matches);
  if (!profile) notFound();

  const recent  = getRecentMatches(id, matches, 6);
  const streamer = streamers.find(s => s.id === id)!;
  const top3     = profile.heroStats.slice(0, 3);
  const rest     = profile.heroStats.slice(3);
  const tc       = TIER_COLOR[profile.tier];

  return (
    <div style={{
      display: 'flex', gap: 'var(--sp-6)',
      alignItems: 'flex-start',
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: 'var(--sp-7) 0 var(--sp-20)',
    }}>
      {/* ── 사이드바 ── */}
      <aside style={{
        width: 310, flexShrink: 0,
        position: 'sticky', top: 80,
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>
        {/* 아바타 + 이름 + 티어 */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)',
        }}>
          {/* 아바타 */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `color-mix(in srgb, ${tc} 10%, var(--surface-raise))`,
            border: `2px solid color-mix(in srgb, ${tc} 40%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
            color: tc,
          }}>
            {streamer.name.slice(0, 2)}
          </div>

          {/* 이름 */}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
            color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
            {streamer.name}
          </span>

          {/* 티어 + 역할 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <TierBadge tier={profile.tier} />
            {streamer.role && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
                borderRadius: 'var(--r-xs)',
                background: 'var(--surface-raise)', border: '1px solid var(--border-line)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
                letterSpacing: '0.04em',
              }}>
                {streamer.role}
              </span>
            )}
          </div>
        </div>

        {/* 스탯 필 */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-4)',
          display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <StatPill label="총 경기" value={String(profile.totalGames)} />
            <StatPill label="승"      value={String(profile.wins)} />
            <StatPill label="패"      value={String(profile.losses)} />
          </div>

          {/* 승률 바 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
                color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
                WIN RATE
              </span>
              <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 13,
                color: profile.winRate >= 0.5 ? 'var(--win)' : 'var(--loss)' }}>
                {pct(profile.winRate)}
              </span>
            </div>
            <WinRateBar wins={profile.wins} total={profile.totalGames} />
          </div>
        </div>
      </aside>

      {/* ── 메인 피드 ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        {/* 영웅 스탯 */}
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 'var(--sp-3)' }}>
            영웅별 승률
          </h2>

          {profile.heroStats.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 13,
              fontFamily: 'var(--font-ui)' }}>
              경기 기록이 없습니다.
            </p>
          ) : (
            <>
              {/* 상위 3 카드 */}
              {top3.length > 0 && (
                <div style={{ display: 'grid',
                  gridTemplateColumns: `repeat(${top3.length}, 1fr)`,
                  gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                  {top3.map(h => <HeroCard key={h.hero} h={h} rank />)}
                </div>
              )}

              {/* 나머지 목록 */}
              {rest.length > 0 && (
                <div style={{
                  background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border-line)', overflow: 'hidden',
                }}>
                  {rest.map(h => <HeroCard key={h.hero} h={h} />)}
                </div>
              )}
            </>
          )}
        </section>

        {/* 최근 경기 */}
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 'var(--sp-3)' }}>
            최근 경기
          </h2>

          {recent.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 13,
              fontFamily: 'var(--font-ui)' }}>
              경기 기록이 없습니다.
            </p>
          ) : (
            <div style={{
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)', overflow: 'hidden',
            }}>
              {recent.map(m => (
                <MatchRow key={m.id} m={m} streamerId={id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
