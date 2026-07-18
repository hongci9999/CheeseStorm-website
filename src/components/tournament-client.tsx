'use client';

// 대회 페이지 — 팀 정보 · 경기 기록 · 포지션 통계 3탭.
// 데이터는 서버(page.tsx)에서 집계된 TournamentData 뷰모델을 그대로 렌더만 한다.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import { sectionCard, sectionTitle, sectionHint, th, td, tdLeft } from '@/components/scrim-dashboard';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type { TournamentData, TeamVM, GameVM, SideVM, PlayerVM } from '@/lib/tournament';

// 팀 구분 액센트 — 카드 링·표 강조 공용 (인덱스 = 설정 순서)
const TEAM_ACCENTS = ['var(--cheese-blue)', 'var(--cheese-green)', '#E93CC8', '#FFA657'];

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const rateColor = (r: number) => (r >= 0.5 ? 'var(--win)' : 'var(--loss)');
const fmt1 = (n: number | null) => (n === null ? '—' : n.toFixed(2));
const fmtInt = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('ko-KR'));

function streakLabel(streak: number): { text: string; color: string } {
  if (streak > 0) return { text: `${streak}연승 중`, color: 'var(--win)' };
  if (streak < 0) return { text: `${-streak}연패 중`, color: 'var(--loss)' };
  return { text: '—', color: 'var(--text-faint)' };
}

type TabKey = 'teams' | 'games' | 'positions';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'teams', label: '팀 정보' },
  { key: 'games', label: '경기 기록' },
  { key: 'positions', label: '포지션 통계' },
];

export default function TournamentClient({ data }: { data: TournamentData }) {
  const [tab, setTab] = useState<TabKey>('teams');
  const bp = useBreakpoint();
  const desktop = bp === 'desktop';

  return (
    <main style={{
      maxWidth: 'var(--container)', margin: '0 auto',
      padding: desktop ? 'var(--sp-6) var(--sp-6) var(--sp-8)' : 'var(--sp-4) var(--sp-4) 84px',
      display: 'grid', gap: 'var(--sp-4)', alignContent: 'start',
    }}>
      {/* 타이틀 */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-2xl)', color: 'var(--text-strong)', lineHeight: 1.2 }}>
          대회
        </h1>
        <p style={{ ...sectionHint, marginTop: 4 }}>
          스트리머 대회 스크림 기록 — 팀 로스터 기준으로 내전 기록실 경기를 자동 분류합니다.
        </p>
      </div>

      {/* 탭 */}
      <div role="tablist" style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button key={key} role="tab" aria-selected={active} onClick={() => setTab(key)}
              style={{
                height: 'var(--control-md, 38px)', padding: '0 var(--sp-4)',
                borderRadius: 'var(--r-pill)', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
                background: active
                  ? 'color-mix(in srgb, var(--cheese-green) 14%, transparent)' : 'transparent',
                color: active ? 'var(--text-high)' : 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
                fontSize: 'var(--fs-sm)',
                transition: 'all var(--dur-fast) var(--ease-out)',
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {!data.configured && (
        <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
          팀 로스터가 아직 설정되지 않았습니다. <code>src/lib/tournament.ts</code>의{' '}
          <code>TOURNAMENT_TEAMS</code>에 팀장·팀원 스트리머 이름을 채우면
          경기 분류와 통계가 자동으로 표시됩니다.
        </p>
      )}

      {tab === 'teams' && <TeamsTab data={data} desktop={desktop} />}
      {tab === 'games' && <GamesTab games={data.games} desktop={desktop} />}
      {tab === 'positions' && <PositionsTab data={data} />}
    </main>
  );
}

// ── 탭 1: 팀 정보 ────────────────────────────────────────────

function TeamCard({ team, accent }: { team: TeamVM; accent: string }) {
  const member = (m: { name: string; img?: string; resolved: boolean }, size: number, leader = false) => (
    <div key={`${m.name}-${leader}`} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0,
    }}>
      <HexAvatar name={m.name} imageUrl={m.img} size={size}
        ring={leader ? accent : `color-mix(in srgb, ${accent} 45%, var(--border-line))`}
        ringWidth={leader ? 3 : 2}
        imgStyle={m.resolved ? undefined : { filter: 'grayscale(1)' }} />
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: leader ? 800 : 600,
        fontSize: leader ? 'var(--fs-sm)' : 'var(--fs-xs)',
        color: m.resolved ? 'var(--text-high)' : 'var(--text-faint)',
        maxWidth: size + 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{m.name}</span>
      {leader && (
        <span style={{
          padding: '1px 8px', borderRadius: 'var(--r-pill)',
          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
          color: accent, fontFamily: 'var(--font-numeral)', fontWeight: 700,
          fontSize: 10, letterSpacing: '0.08em',
        }}>팀장</span>
      )}
    </div>
  );

  return (
    <section style={{ ...sectionCard, justifyItems: 'center', gap: 'var(--sp-4)', position: 'relative' }}>
      {/* 팀 이름 + 전적 요약 */}
      <div style={{ justifySelf: 'stretch', display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
        <h2 style={{ ...sectionTitle, color: accent }}>{team.name}</h2>
        <span style={sectionHint}>{team.captain.name}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-numeral)',
          fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {team.games ? `${team.wins}승 ${team.losses}패` : '경기 없음'}
        </span>
      </div>
      {member(team.captain, 72, true)}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {team.members.map((m, i) => (
          <span key={i} style={{ display: 'contents' }}>{member(m, 56)}</span>
        ))}
      </div>
    </section>
  );
}

function TeamsTab({ data, desktop }: { data: TournamentData; desktop: boolean }) {
  const { teams, h2h } = data;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {/* 팀 카드 2×2 */}
      <div style={{
        display: 'grid', gap: 'var(--sp-4)',
        gridTemplateColumns: desktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
      }}>
        {teams.map((t, i) => <TeamCard key={t.id} team={t} accent={TEAM_ACCENTS[i % TEAM_ACCENTS.length]} />)}
      </div>

      {/* 팀별 전적 */}
      <section style={sectionCard}>
        <h2 style={sectionTitle}>팀별 전적</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>팀</th>
              <th style={th}>경기</th><th style={th}>승</th><th style={th}>패</th>
              <th style={th}>승률</th><th style={th}>연속</th>
            </tr></thead>
            <tbody>
              {teams.map((t, i) => {
                const sk = streakLabel(t.streak);
                const accent = TEAM_ACCENTS[i % TEAM_ACCENTS.length];
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-line) 55%, transparent)' }}>
                    <td style={tdLeft}>
                      <span style={{ fontWeight: 800, color: accent }}>{t.name}</span>
                      <span style={{ ...sectionHint, marginLeft: 8 }}>{t.captain.name}</span>
                    </td>
                    <td style={td}>{t.games}</td>
                    <td style={{ ...td, color: 'var(--win)', fontWeight: 700 }}>{t.wins}</td>
                    <td style={{ ...td, color: 'var(--loss)', fontWeight: 700 }}>{t.losses}</td>
                    <td style={{ ...td, fontWeight: 800, color: t.games ? rateColor(t.winRate) : 'var(--text-faint)' }}>
                      {t.games ? pct(t.winRate) : '—'}
                    </td>
                    <td style={{ ...td, color: sk.color, fontWeight: 700 }}>{sk.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 팀 간 상대전적 매트릭스 */}
      <section style={sectionCard}>
        <h2 style={sectionTitle}>팀 간 상대전적</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>vs</th>
              {teams.map((t, i) => (
                <th key={t.id} style={{ ...th, textAlign: 'center', color: TEAM_ACCENTS[i % TEAM_ACCENTS.length] }}>
                  {t.name}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {teams.map((row, ri) => (
                <tr key={row.id}>
                  <td style={{ ...tdLeft, fontWeight: 800, color: TEAM_ACCENTS[ri % TEAM_ACCENTS.length] }}>
                    {row.name}
                  </td>
                  {teams.map((col, ci) => {
                    const cell = h2h[ri]?.[ci];
                    if (ri === ci) return (
                      <td key={col.id} style={{ ...td, textAlign: 'center', color: 'var(--text-faint)' }}>—</td>
                    );
                    if (!cell) return (
                      <td key={col.id} style={{ ...td, textAlign: 'center', color: 'var(--text-faint)' }}>0 - 0</td>
                    );
                    // 우세 = win-soft, 열세 = loss-soft 배경 틴트 (예시 이미지 규약)
                    const bg = cell.winRate > 0.5 ? 'var(--win-soft)'
                      : cell.winRate < 0.5 ? 'var(--loss-soft)' : 'transparent';
                    return (
                      <td key={col.id} style={{ ...td, textAlign: 'center', background: bg, padding: '8px' }}>
                        <span style={{ fontWeight: 800 }}>
                          <span style={{ color: 'var(--win)' }}>{cell.wins}</span>
                          <span style={{ color: 'var(--text-faint)' }}> - </span>
                          <span style={{ color: 'var(--loss)' }}>{cell.losses}</span>
                        </span>
                        <span style={{ ...sectionHint, display: 'block', marginTop: 2 }}>
                          {cell.games}경기 · {pct(cell.winRate)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span style={sectionHint}>셀 값은 행 기준 팀의 승-패 · 아래는 총 경기수와 행 기준 팀의 승률.</span>
      </section>
    </div>
  );
}

// ── 탭 2: 경기 기록 ──────────────────────────────────────────

function PlayerRow({ p, mirror }: { p: PlayerVM; mirror: boolean }) {
  // mirror=false(왼쪽 팀): 텍스트 | 영웅헥스 / mirror=true(오른쪽 팀): 영웅헥스 | 텍스트
  const info = (
    <span style={{ minWidth: 0, display: 'grid', gap: 1, textAlign: mirror ? 'left' : 'right' }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--fs-xs)',
        color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.name}
        {p.kda && (
          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 600,
            color: 'rgba(255,255,255,0.75)', marginLeft: 6 }}>{p.kda}</span>
        )}
      </span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10,
        color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.gameName ?? ''}
      </span>
    </span>
  );
  const hex = (
    <HexAvatar name={p.hero} imageUrl={heroImageUrl(p.hero)} size={44}
      ring="rgba(255,255,255,0.5)" />
  );
  return (
    <div style={{
      display: 'grid', gap: 'var(--sp-2)', alignItems: 'center',
      gridTemplateColumns: mirror ? '44px minmax(0, 1fr)' : 'minmax(0, 1fr) 44px',
      justifyItems: mirror ? 'start' : 'end',
    }}>
      {mirror ? <>{hex}{info}</> : <>{info}{hex}</>}
    </div>
  );
}

function SideBlock({ side, mirror, showFirstPick }: { side: SideVM; mirror: boolean; showFirstPick: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)', alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
        flexDirection: mirror ? 'row' : 'row-reverse' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-sm)', color: '#fff' }}>{side.teamName}</span>
        {side.won && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 999, background: 'var(--win)',
            color: 'var(--bg-void)', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 11 }}>승</span>
        )}
        {showFirstPick && side.firstPick && (
          <span style={{ padding: '1px 8px', borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.35)',
            color: '#fff', fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 10,
            letterSpacing: '0.08em' }}>선픽</span>
        )}
      </div>
      {side.players.map((p, i) => <PlayerRow key={i} p={p} mirror={mirror} />)}
    </div>
  );
}

function GameCard({ g, desktop }: { g: GameVM; desktop: boolean }) {
  return (
    <article style={{ position: 'relative', overflow: 'hidden',
      borderRadius: 'var(--r-lg)', border: '1px solid var(--border-line)' }}>
      {/* 배경 = 맵 이미지 (예시 이미지 규약) */}
      {g.mapImg && <Image src={g.mapImg} alt={g.map ?? ''} fill sizes="1100px"
        style={{ objectFit: 'cover', filter: 'brightness(0.55) saturate(0.85)' }} />}
      {!g.mapImg && <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--surface-card)' }} />}
      <span aria-hidden style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.65))' }} />

      <div style={{ position: 'relative', display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
        {/* 헤더: 날짜 · 스크림 번호 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700,
            fontSize: 'var(--fs-sm)', color: '#fff', letterSpacing: '0.04em' }}>{g.dateLabel}</span>
          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800,
            fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.8)' }}>스크림 #{g.no}</span>
          {!g.firstPickKnown && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: 10,
              color: 'rgba(255,255,255,0.45)' }}>선픽 미기록</span>
          )}
        </div>

        {/* 본문: 좌팀 | 우팀 (모바일은 세로 스택) */}
        <div style={{
          display: 'grid', gap: 'var(--sp-4)',
          gridTemplateColumns: desktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        }}>
          <SideBlock side={g.left} mirror={false} showFirstPick={g.firstPickKnown} />
          <SideBlock side={g.right} mirror showFirstPick={g.firstPickKnown} />
        </div>

        {/* 푸터: 맵 이름 · 경기 시간 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'var(--fs-md)', color: '#fff' }}>{g.map ?? '맵 미기록'}</span>
          {g.dur && (
            <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 'var(--fs-xs)',
              color: 'rgba(255,255,255,0.75)' }}>{g.dur}</span>
          )}
          {g.firstPickKnown && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: 10,
              color: 'rgba(255,255,255,0.55)' }}>왼쪽이 선픽</span>
          )}
        </div>
      </div>
    </article>
  );
}

function GamesTab({ games, desktop }: { games: GameVM[]; desktop: boolean }) {
  if (games.length === 0) {
    return <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
      분류된 대회 스크림이 없습니다. 내전기록실에 경기를 입력하면 팀 로스터 기준으로 자동 분류됩니다.
    </p>;
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {games.map((g) => <GameCard key={g.id} g={g} desktop={desktop} />)}
    </div>
  );
}

// ── 탭 3: 포지션 통계 ────────────────────────────────────────

function PositionsTab({ data }: { data: TournamentData }) {
  if (data.positions.length === 0) {
    return <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
      집계할 경기가 없습니다.
    </p>;
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {data.positions.map(({ role, rows }) => (
        <section key={role} style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
            <h2 style={sectionTitle}>{role}</h2>
            <span style={sectionHint}>KP = 킬 관여율 · /분 지표는 경기시간 기록된 경기만 집계</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>스트리머</th>
                <th style={{ ...th, textAlign: 'left' }}>팀</th>
                <th style={th}>경기</th><th style={th}>승</th><th style={th}>승률</th>
                <th style={th}>KDA</th><th style={th}>KP</th>
                <th style={th}>영웅딜/분</th><th style={th}>공성딜/분</th>
                <th style={th}>힐/분</th><th style={th}>XP/분</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-line) 55%, transparent)' }}>
                    <td style={tdLeft}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <HexAvatar name={r.name} imageUrl={r.img} ring="var(--border-strong)" size={26} />
                        <span style={{ fontWeight: 700, color: 'var(--text-high)' }}>{r.name}</span>
                      </span>
                    </td>
                    <td style={{ ...tdLeft, color: 'var(--text-muted)' }}>{r.teamName}</td>
                    <td style={td}>{r.games}</td>
                    <td style={td}>{r.wins}</td>
                    <td style={{ ...td, fontWeight: 800, color: rateColor(r.winRate) }}>{pct(r.winRate)}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-high)' }}>{fmt1(r.kda)}</td>
                    <td style={td}>{r.kp === null ? '—' : pct(r.kp)}</td>
                    <td style={td}>{fmtInt(r.heroDmgPerMin)}</td>
                    <td style={td}>{fmtInt(r.siegeDmgPerMin)}</td>
                    <td style={td}>{fmtInt(r.healingPerMin)}</td>
                    <td style={td}>{fmtInt(r.xpPerMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
