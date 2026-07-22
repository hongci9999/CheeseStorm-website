import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getStreamers, getMatchesCached, unpackStoredMatch } from '@/lib/firestore';
import { getPrecomputedStatsCachedServer, getPrecomputedProfileCachedServer } from '@/lib/firestore.server';
import type { PrecomputedProfile } from '@/lib/firestore';
import { getStreamerProfile, getRecentMatches, kdaFor } from '@/lib/profile';
import { fineRoleAffinity } from '@/lib/heroes';
import { MIN_SAMPLE } from '@/lib/sample';
import { aggregateHeroStats } from '@/lib/hero-stats';
import { computeRelations } from '@/lib/relations';
import { mapWinRates } from '@/lib/map-stats';
import { HexAvatar } from '@/components/hexagon-avatar';
import { LevelBadge } from '@/components/level-badge';
import { ProSticker } from '@/components/pro-sticker';
import { isProStreamer } from '@/lib/pro-streamers';
import { CrownSticker } from '@/components/crown-sticker';
import { isTournamentChampion } from '@/lib/tournament';
import type { SynergyStat, NemesisStat } from '@/lib/relations';
import type { Match, Streamer, PlayerStats } from '@/lib/types';
import { ProfileTabs } from './profile-tabs';
import type { SerializedMatch } from './profile-tabs';
import { ProfileLayout } from './profile-layout';


// --- 직렬화 헬퍼 (Date → ISO string) ---
function serializeMatch(m: Match): SerializedMatch {
  return { ...m, date: m.date.toISOString(), createdAt: m.createdAt.toISOString() };
}

// --- 공통 UI ---
function SectionHead({ ko, en }: { ko: string; en: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--sp-4)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
        color: 'var(--text-strong)', margin: 0 }}>{ko}</h2>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10.5, letterSpacing: '0.1em',
        color: 'var(--text-faint)', textTransform: 'uppercase' }}>{en}</span>
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

// --- 스켈레톤 (Suspense 폴백) ---
const SKEL: React.CSSProperties = {
  borderRadius: 'var(--r-sm)',
  background: 'var(--surface-raise)',
  animation: 'skel-pulse 1.5s ease-in-out infinite',
};

function SidebarStatsSkeleton() {
  return (
    <>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)',
      }}>
        <div style={{ ...SKEL, width: '35%', height: 32 }} />
        <div style={{ display: 'flex', gap: 'var(--sp-6)' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ ...SKEL, width: 48, height: 20 }} />
              <div style={{ ...SKEL, width: 36, height: 10 }} />
            </div>
          ))}
        </div>
        <div style={{ ...SKEL, width: '100%', height: 8 }} />
      </div>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
      }}>
        <div style={{ ...SKEL, width: '45%', height: 16 }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div style={{ ...SKEL, width: 46, height: 13 }} />
            <div style={{ ...SKEL, flex: 1, height: 12 }} />
            <div style={{ ...SKEL, width: 68, height: 13 }} />
          </div>
        ))}
      </div>
    </>
  );
}

function TabsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-2)',
        display: 'flex', gap: 'var(--sp-2)',
      }}>
        {[68, 72, 96].map(w => <div key={w} style={{ ...SKEL, width: w, height: 36 }} />)}
      </div>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>
        <div style={{ ...SKEL, width: '30%', height: 18 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)' }}>
          {[0, 1, 2].map(i => <div key={i} style={{ ...SKEL, height: 148 }} />)}
        </div>
        <div style={{ ...SKEL, width: '100%', height: 16 }} />
        <div style={{ ...SKEL, width: '80%', height: 16 }} />
      </div>
    </div>
  );
}

// --- 정적 카드: matches 없이 즉시 렌더 ---
function StaticProfileCard({ streamer }: { streamer: Streamer }) {
  return (
    <div style={{
      background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border-line)',
      boxShadow: 'var(--shadow-sm)',
      padding: 'var(--sp-4) var(--sp-6)', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
        <div style={{ position: 'relative', display: 'inline-flex', overflow: 'visible' }}>
          <HexAvatar
            name={streamer.name}
            imageUrl={streamer.profileImageUrl}
            ring="var(--hots-purple)"
            ringWidth={4}
            size={124}
          />
          {isProStreamer(streamer) && <ProSticker />}
          {isTournamentChampion(streamer) && <CrownSticker />}
        </div>
      </div>
      <div style={{ marginTop: 'var(--sp-4)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
          {streamer.name}
        </span>
      </div>
      {streamer.gameNames && streamer.gameNames.length > 0 && (
        <div style={{ marginTop: 4, fontFamily: 'var(--font-numeral)', fontSize: 12,
          color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' }}>
          {streamer.gameNames.join(' · ')}
        </div>
      )}
      {streamer.accountLevel != null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 5, marginTop: 8 }}>
          <LevelBadge level={streamer.accountLevel} />
        </div>
      )}
    </div>
  );
}

// --- 동적 사이드바 stats: matches 로드 후 스트리밍 ---
async function SidebarStatsSection({ streamerId, streamers, precomputed }: {
  streamerId: string;
  streamers?: Streamer[];
  precomputed?: { profile: PlayerStats; kda: number | null; affinity: { role: string; games: number; wins: number; pct: number }[] };
}) {
  let profile: PlayerStats | null;
  let kda: number | null;
  let affinity: { role: string; games: number; wins: number; pct: number }[];

  if (precomputed) {
    ({ profile, kda, affinity } = precomputed);
    // wins 추가 전에 만들어진 옛 통계 캐시면 matches로 즉석 재집계 (재집계 전까지 self-heal)
    if (affinity.some((r) => r.wins === undefined)) {
      affinity = fineRoleAffinity(await getMatchesCached(), streamerId);
    }
  } else {
    const matches = await getMatchesCached();
    profile = getStreamerProfile(streamerId, streamers!, matches);
    if (!profile) return null;
    kda = kdaFor(matches, streamerId);
    affinity = fineRoleAffinity(matches, streamerId);
  }

  if (!profile) return null;
  const maxAff = affinity.length > 0 ? affinity[0].games : 1;

  return (
    <>
      {/* 스탯 카드 */}
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-6)' }}>
          <StatPill value={String(Math.round(profile.winRate * 100))} suffix="%" label="WIN RATE" accent="green" />
          <StatPill value={kda != null ? kda.toFixed(2) : '—'} label="KDA" accent="blue" />
          <StatPill value={String(profile.totalGames)} label="총 경기" />
        </div>
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

      {/* 선호 포지션 카드 */}
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
              {affinity.map((r, i) => {
                const top = i === 0; // 최다 플레이 = 주 포지션. 나머지는 회색 바
                return (
                <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span style={{ width: 46, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                    color: top ? 'var(--text-high)' : 'var(--text-muted)' }}>{r.role}</span>
                  {/* 트랙 = 전체 판수, 채움 = 이긴 판수. 최상단만 초록, 나머지는 회색 */}
                  <div style={{ flex: 1, height: 12, borderRadius: 999,
                    background: 'var(--surface-raise)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(r.games / maxAff) * 100}%`, height: '100%', borderRadius: 999,
                      background: top
                        ? 'color-mix(in srgb, var(--cheese-green) 28%, var(--surface-raise))'
                        : 'color-mix(in srgb, var(--text-muted) 25%, var(--surface-raise))',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: r.games > 0 ? `${(r.wins / r.games) * 100}%` : '0%', height: '100%',
                        borderRadius: 999,
                        background: top ? 'var(--cheese-green)' : 'var(--text-muted)',
                        boxShadow: top ? 'var(--glow-green-soft)' : 'none',
                      }} />
                    </div>
                  </div>
                  <span style={{ width: 70, textAlign: 'right', fontFamily: 'var(--font-numeral)',
                    fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.pct}% · {r.games}판
                  </span>
                </div>
                );
              })}
            </div>
            {(() => {
              // 승률 최고 포지션 — MIN_SAMPLE판 이상만 후보, 동률이면 판수 많은 쪽
              const best = affinity
                .filter((r) => r.games >= MIN_SAMPLE)
                .sort((a, b) => (b.wins / b.games) - (a.wins / a.games) || b.games - a.games)[0];
              if (!best) return null; // 5판 이상 포지션 없으면 문구 숨김
              return (
                <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)',
                  borderTop: '1px solid var(--border-faint)',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--cheese-green)', boxShadow: '0 0 8px var(--cheese-green)' }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
                    승률 최고 포지션 <b style={{ color: 'var(--text-high)' }}>{best.role}</b>
                    {' '}· {Math.round((best.wins / best.games) * 100)}%
                  </span>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}

// --- 동적 탭 섹션: matches 로드 후 스트리밍 (SidebarStatsSection과 getMatchesCached 공유) ---
async function ProfileTabsServer({
  streamerId, streamers, initialTab, precomputed,
}: {
  streamerId: string;
  streamers?: Streamer[];
  initialTab: 'overview' | 'heroes' | 'matches';
  precomputed?: {
    profile: PlayerStats;
    profileData: PrecomputedProfile;
    streamerBasics: { id: string; name: string; profileImageUrl?: string }[];
  };
}) {
  if (precomputed) {
    const { profile, profileData, streamerBasics } = precomputed;
    return (
      <ProfileTabs
        streamerId={streamerId}
        initialTab={initialTab}
        heroStats={profile.heroStats}
        heroAggregates={profileData.heroAggregates}
        recentMatches={profileData.recentMatches.map(unpackStoredMatch)}
        allMatches={profileData.allMatches.map(unpackStoredMatch)}
        synergy={profileData.synergy.map(s => ({ streamerId: s.streamerId, streamerName: s.streamerName, games: s.games, rate: s.winRate }))}
        nemesis={profileData.nemesis.map(n => ({ streamerId: n.streamerId, streamerName: n.streamerName, games: n.games, rate: n.lossRate }))}
        maps={profileData.maps}
        streamers={streamerBasics}
      />
    );
  }

  const matches = await getMatchesCached();
  const profile = getStreamerProfile(streamerId, streamers!, matches);
  if (!profile) return null;

  const heroAggregates = aggregateHeroStats(streamerId, matches);
  const { synergy, nemesis } = computeRelations(streamerId, streamers!, matches);
  const maps = mapWinRates(streamerId, matches);

  const synergyRows = synergy.map((s: SynergyStat) => ({
    streamerId: s.streamerId, streamerName: s.streamerName,
    games: s.games, rate: s.winRate,
  }));
  const nemesisRows = nemesis.map((n: NemesisStat) => ({
    streamerId: n.streamerId, streamerName: n.streamerName,
    games: n.games, rate: n.lossRate,
  }));
  const streamerBasics = streamers!.map(s => ({
    id: s.id, name: s.name, profileImageUrl: s.profileImageUrl,
  }));
  const recent = getRecentMatches(streamerId, matches, 6);
  const allMatches = getRecentMatches(streamerId, matches, Infinity);

  return (
    <ProfileTabs
      streamerId={streamerId}
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

  // 빠른 경로: stats/current(+profiles 서브컬렉션) 2 read로 전체 프로필 렌더 (streamers + matches 컬렉션 read 없음)
  const [precomputedStats, profileData] = await Promise.all([
    getPrecomputedStatsCachedServer(),
    getPrecomputedProfileCachedServer(id),
  ]);
  const playerStat = precomputedStats?.playerStats.find(p => p.streamerId === id);

  if (profileData && playerStat) {
    const streamer: Streamer = {
      id,
      name: profileData.streamerName,
      profileImageUrl: profileData.profileImageUrl,
      gameNames: profileData.gameNames,
      accountLevel: profileData.accountLevel,
      createdAt: new Date(0),
    };

    if (!streamer.name) notFound();

    const streamerBasics = precomputedStats!.playerStats.map(p => ({
      id: p.streamerId,
      name: p.streamerName,
      profileImageUrl: p.profileImageUrl,
    }));

    const sidebar = (
      <>
        <StaticProfileCard streamer={streamer} />
        <SidebarStatsSection
          streamerId={id}
          precomputed={{ profile: playerStat, kda: profileData.kda, affinity: profileData.roleAffinity }}
        />
      </>
    );

    return (
      <ProfileLayout sidebar={sidebar}>
        <ProfileTabsServer
          streamerId={id}
          initialTab={initialTab}
          precomputed={{ profile: playerStat, profileData, streamerBasics }}
        />
      </ProfileLayout>
    );
  }

  // 느린 경로 (폴백): 기존 동작 — stats/current 없을 때
  const streamers = await getStreamers();
  const streamer = streamers.find(s => s.id === id);
  if (!streamer) notFound();

  const sidebar = (
    <>
      {/* 아바타·이름·배틀태그·레벨 — getStreamers()만으로 즉시 렌더 */}
      <StaticProfileCard streamer={streamer} />
      {/* 티어·승률·KDA·포지션 — getMatchesCached() 후 스트리밍 */}
      <Suspense fallback={<SidebarStatsSkeleton />}>
        <SidebarStatsSection streamerId={id} streamers={streamers} />
      </Suspense>
    </>
  );

  return (
    <ProfileLayout sidebar={sidebar}>
      {/* 탭 전체 — getMatchesCached() 후 스트리밍 (SidebarStatsSection과 Firestore 호출 공유) */}
      <Suspense fallback={<TabsSkeleton />}>
        <ProfileTabsServer streamerId={id} streamers={streamers} initialTab={initialTab} />
      </Suspense>
    </ProfileLayout>
  );
}
