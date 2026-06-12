import { notFound } from 'next/navigation';
import { getStreamers, getMatches, isFirebaseConfigured } from '@/lib/firestore';
import { getStreamerProfile, getRecentMatches, currentStreak, kdaFor } from '@/lib/profile';
import { calcPlayerStats } from '@/lib/tier';
import { roleAffinity, roleOfHero } from '@/lib/heroes';
import { outcomeFor, heroOf, statOf } from '@/lib/match';
import { MOCK_STREAMERS } from '@/test/fixtures/streamers';
import { MOCK_MATCHES } from '@/test/fixtures/matches';
import HexAvatar from '@/components/hex-avatar';
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

function HeroAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 'var(--r-sm)', flexShrink: 0,
      background: 'var(--surface-raise)', border: '1px solid var(--border-faint)',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: Math.round(size * 0.38),
      color: 'var(--text-muted)',
    }}>
      {name.slice(0, 2)}
    </span>
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

  const streamer = streamers.find(s => s.id === id)!;
  const allStats = calcPlayerStats(streamers, matches);
  const rank     = allStats.findIndex(p => p.streamerId === id) + 1;
  const streak   = currentStreak(matches, id);
  const kda      = kdaFor(matches, id);
  const affinity = roleAffinity(matches, id);
  const maxAff   = affinity.length > 0 ? affinity[0].games : 1;
  const recent   = getRecentMatches(id, matches, 6);
  const top3     = profile.heroStats.slice(0, 3);
  const rest     = profile.heroStats.slice(3, 10);
  const tc       = TIER_COLOR[profile.tier];

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
              src={streamer.profileImageUrl}
              initials={streamer.name.slice(0, 2)}
              size={104}
              borderColor={tc}
              alt={streamer.name}
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

          {/* 계정레벨 — 주요 정보로 강조 */}
          {streamer.accountLevel != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 22, padding: '0 10px', borderRadius: 'var(--r-pill)',
                background: 'color-mix(in srgb, var(--cheese-blue) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--cheese-blue) 35%, transparent)',
                fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 12,
                color: 'var(--cheese-blue)', letterSpacing: '0.02em',
              }}>
                Lv.{streamer.accountLevel}
              </span>
            </div>
          )}

          {/* 연승 배지 + 메인 롤 · 랭킹 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {streak && streak.count >= 2 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 22, padding: '0 9px', borderRadius: 'var(--r-pill)',
                background: streak.result === 'win' ? 'var(--win-soft)' : 'var(--loss-soft)',
                color: streak.result === 'win' ? 'var(--win)' : 'var(--loss)',
                fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                {streak.count}{streak.result === 'win' ? '연승' : '연패'}
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {profile.role ? `${profile.role} 메인 · ` : ''}랭킹 #{rank}
            </span>
          </div>

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
                        background: i === 0 ? 'var(--cheese-green)' : 'var(--ink-600)',
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
                  const role = roleOfHero(h.hero);
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

        {/* 최근 매치 */}
        <div style={{
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        }}>
          <SectionHead ko="최근 매치" en="Recent matches"
            right={<span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
              color: 'var(--text-faint)' }}>최근 {recent.length}경기</span>} />

          {recent.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-ui)', margin: 0 }}>
              경기 기록이 없습니다.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map(m => {
                const win = outcomeFor(m, id) === 'win';
                const hero = heroOf(m, id) ?? '—';
                const kdaStr = kdaOfMatch(m, id);
                return (
                  // 풀높이 좌측 바 — overflow hidden으로 내부 바가 행을 꽉 채움
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'stretch',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface-raise)',
                    overflow: 'hidden',
                    minHeight: 50,
                  }}>
                    {/* 풀높이 좌측 바 — 승패 색으로만 전달, 칩 없음 */}
                    <span style={{
                      width: 4, flexShrink: 0,
                      background: win ? 'var(--win)' : 'var(--loss)',
                    }} />

                    {/* 내용 영역 */}
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center',
                      gap: 'var(--sp-3)', padding: '0 var(--sp-3)',
                    }}>
                      <HeroAvatar name={hero} size={32} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 72 }}>
                        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5,
                          color: 'var(--text-high)' }}>{hero}</span>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5,
                          color: 'var(--text-faint)' }}>{m.map ?? '—'}</span>
                      </div>
                      {kdaStr && (
                        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 13,
                          color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap', marginLeft: 'var(--sp-2)' }}>
                          {kdaStr}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-numeral)',
                        fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                        {m.dur ? `${m.dur} · ` : ''}{fmtDate(m.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
