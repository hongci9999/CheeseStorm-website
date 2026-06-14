import { notFound } from 'next/navigation';
import { getStreamers, getMatches } from '@/lib/firestore';
import { getStreamerProfile, getRecentMatches, kdaFor } from '@/lib/profile';
import { fineRoleAffinity } from '@/lib/heroes';
import { aggregateHeroStats } from '@/lib/hero-stats';
import { computeRelations } from '@/lib/relations';
import { mapWinRates } from '@/lib/map-stats';
import { HexAvatar } from '@/components/hexagon-avatar';
import { LevelBadge } from '@/components/level-badge';
import { ProSticker } from '@/components/pro-sticker';
import { isProStreamer } from '@/lib/pro-streamers';
import type { SynergyStat, NemesisStat } from '@/lib/relations';
import type { Match, Tier } from '@/lib/types';
import { ProfileTabs } from './profile-tabs';
import type { SerializedMatch } from './profile-tabs';

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

// --- 직렬화 헬퍼 (Date → ISO string, 서버→클라이언트 경계) ---
function serializeMatch(m: Match): SerializedMatch {
  return { ...m, date: m.date.toISOString(), createdAt: m.createdAt.toISOString() };
}

// --- 사이드바용 컴포넌트 ---
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

// --- 메인 페이지 ---
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  const initialTab: 'overview' | 'heroes' | 'matches' =
    tab === 'heroes' ? 'heroes' : tab === 'matches' ? 'matches' : 'overview';

  const [streamers, matches] = await Promise.all([getStreamers(), getMatches()]);

  const profile = getStreamerProfile(id, streamers, matches);
  if (!profile) notFound();

  const streamer  = streamers.find(s => s.id === id)!;
  const kda       = kdaFor(matches, id);
  const affinity  = fineRoleAffinity(matches, id);
  const maxAff    = affinity.length > 0 ? affinity[0].games : 1;
  const tc        = TIER_COLOR[profile.tier];

  const heroAggregates = aggregateHeroStats(id, matches);
  const { synergy, nemesis } = computeRelations(id, streamers, matches);
  const maps = mapWinRates(id, matches);

  const synergyRows = synergy.map((s: SynergyStat) => ({
    streamerId: s.streamerId, streamerName: s.streamerName,
    games: s.games, rate: s.winRate,
  }));
  const nemesisRows = nemesis.map((n: NemesisStat) => ({
    streamerId: n.streamerId, streamerName: n.streamerName,
    games: n.games, rate: n.lossRate,
  }));
  const streamerBasics = streamers.map(s => ({
    id: s.id, name: s.name, profileImageUrl: s.profileImageUrl,
  }));
  const recent     = getRecentMatches(id, matches, 6);
  const allMatches = getRecentMatches(id, matches, Infinity);

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
          <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
            <div style={{ position: 'relative', display: 'inline-flex', overflow: 'visible' }}>
              <HexAvatar
                name={streamer.name}
                imageUrl={streamer.profileImageUrl}
                ring={tc}
                size={104}
              />
              {isProStreamer(streamer) && <ProSticker />}
            </div>
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

          {/* 배틀넷 닉네임 */}
          {streamer.gameNames && streamer.gameNames.length > 0 && (
            <div style={{ marginTop: 4, fontFamily: 'var(--font-numeral)', fontSize: 12,
              color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' }}>
              {streamer.gameNames.join(' · ')}
            </div>
          )}

          {/* 계정레벨 */}
          {streamer.accountLevel != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, marginTop: 8 }}>
              <LevelBadge level={streamer.accountLevel} />
            </div>
          )}

          {/* 메인 롤 */}
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

      {/* ── 메인 피드 (탭) — 클라이언트 컴포넌트로 즉시 전환 ── */}
      <ProfileTabs
        streamerId={id}
        initialTab={initialTab}
        heroStats={profile.heroStats}
        heroAggregates={heroAggregates}
        recentMatches={recent.map(serializeMatch)}
        allMatches={allMatches.map(serializeMatch)}
        synergy={synergyRows}
        nemesis={nemesisRows}
        maps={maps}
        streamers={streamerBasics}
      />
    </div>
  );
}
