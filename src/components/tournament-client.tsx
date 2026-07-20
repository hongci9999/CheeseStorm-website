'use client';

// 대회 페이지 — 팀 정보 · 경기 기록 · 포지션 통계 3탭.
// 데이터는 서버(page.tsx)에서 집계된 TournamentData 뷰모델을 그대로 렌더만 한다.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { HexAvatar, HEX_CLIP } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import { sectionCard, sectionTitle, sectionHint, th, td, tdLeft } from '@/components/scrim-dashboard';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { TOURNAMENT_NAME, TOURNAMENT_SEASON, TOURNAMENT_START, TOURNAMENT_END, POSITION_ORDER } from '@/lib/tournament';
import type { Role } from '@/lib/types';
import type { TournamentData, TeamVM, GameVM, SideVM, PlayerVM } from '@/lib/tournament';

// 팀 구분 액센트 — 카드 링·표 강조 공용 (인덱스 = 설정 순서)
const TEAM_ACCENTS = ['var(--cheese-blue)', 'var(--cheese-green)', '#E93CC8', '#FFA657'];

// 팀당 팀원 슬롯 수 (팀장 제외) — 미정 인원은 빈 육각형으로 자리만 표시
const MEMBER_SLOTS = 4;

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const rateColor = (r: number) => (r >= 0.5 ? 'var(--win)' : 'var(--loss)');
const fmt1 = (n: number | null) => (n === null ? '—' : n.toFixed(2));
const fmtInt = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('ko-KR'));

const tourDateRange = (() => {
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(TOURNAMENT_START)} ~ ${fmt(TOURNAMENT_END)}`;
})();

// 필터용 알약 버튼 — 일차 필터·팀 필터 공용. accent를 주면 활성 색을 팀 색으로.
function Chip({ label, active, onClick, title, accent = 'var(--cheese-green)' }: {
  label: string; active: boolean; onClick: () => void; title?: string; accent?: string;
}) {
  return (
    <button onClick={onClick} aria-pressed={active} title={title}
      style={{
        height: 30, padding: '0 12px', borderRadius: 'var(--r-pill)',
        border: `1px solid ${active ? accent : 'var(--border-line)'}`,
        background: active ? `color-mix(in srgb, ${accent} 14%, transparent)` : 'transparent',
        color: active ? 'var(--text-high)' : 'var(--text-muted)',
        fontFamily: 'var(--font-ui)', fontWeight: active ? 800 : 600, fontSize: 'var(--fs-xs)',
        cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)',
      }}>
      {label}
    </button>
  );
}

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

// 일차별 데이터셋 — [0]은 항상 '전체', 이후 1일차·2일차… (서버에서 집계 완료)
export interface TournamentDaySet { key: string; label: string; data: TournamentData }

export default function TournamentClient({ days }: { days: TournamentDaySet[] }) {
  const [tab, setTab] = useState<TabKey>('teams');
  const [dayKey, setDayKey] = useState('all');
  const bp = useBreakpoint();
  const desktop = bp === 'desktop';
  const data = (days.find((d) => d.key === dayKey) ?? days[0]).data;

  return (
    <main style={{
      maxWidth: 'var(--container)', margin: '0 auto',
      padding: desktop ? 'var(--sp-6) var(--sp-6) var(--sp-8)' : 'var(--sp-4) var(--sp-4) 84px',
      display: 'grid', gap: 'var(--sp-4)', alignContent: 'start',
    }}>
      {/* 타이틀 — 대회 이름 + 시즌 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-2xl)', color: 'var(--text-strong)', lineHeight: 1.2 }}>
          {TOURNAMENT_NAME}
        </h1>
        <span style={{
          padding: '2px 10px', borderRadius: 'var(--r-pill)',
          background: 'color-mix(in srgb, var(--hots-purple) 20%, transparent)',
          border: '1px solid var(--hots-purple)',
          color: 'var(--hots-purple)', fontFamily: 'var(--font-numeral)',
          fontWeight: 700, fontSize: 'var(--fs-xs)', letterSpacing: '0.06em',
        }}>
          {TOURNAMENT_SEASON}
        </span>
        <span style={sectionHint}>{tourDateRange}</span>
      </div>

      {/* 일차 필터 — 전체 / 1일차 / 2일차… 전 탭 공통 적용 (일차 1개뿐이면 숨김) */}
      {days.length > 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {days.map((d) => (
            <Chip key={d.key} label={d.label} active={d.key === dayKey}
              title={d.key === 'all' ? undefined : d.key} onClick={() => setDayKey(d.key)} />
          ))}
        </div>
      )}

      {/* 탭 — 메인 페이지와 동일한 하단 강조선 스타일 */}
      <div role="tablist" style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--border-line)',
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button key={key} role="tab" aria-selected={active} onClick={() => setTab(key)}
              style={{
                position: 'relative',
                height: 44, padding: '0 20px',
                flexShrink: 0, whiteSpace: 'nowrap',
                background: 'transparent', border: 'none',
                fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
                fontSize: 14,
                color: active ? 'var(--text-strong)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color var(--dur-fast) var(--ease-out)',
                // 메인 탭과 동일 — overflowX 컨테이너라 inset 그림자로 강조선
                boxShadow: active ? 'inset 0 -2px 0 var(--cheese-green)' : 'none',
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
      {/* key=일차 — 일차 바꾸면 페이지네이션 1페이지로 리셋 */}
      {tab === 'games' && <GamesTab key={dayKey} games={data.games} teams={data.teams} desktop={desktop} />}
      {tab === 'positions' && <PositionsTab data={data} />}
    </main>
  );
}

// ── 탭 1: 팀 정보 ────────────────────────────────────────────

// 미정 팀원 자리 — 이니셜 없는 빈 육각형 + '미정' 라벨. 팀 액센트를 옅게 머금은 점선 테두리.
function EmptySlot({ size, accent }: { size: number; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
        <span style={{
          position: 'absolute', inset: 0, clipPath: HEX_CLIP, padding: 2, display: 'flex',
          background: `color-mix(in srgb, ${accent} 28%, var(--border-line))`,
        }}>
          <span style={{
            display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
            clipPath: HEX_CLIP, background: 'var(--surface-raise)',
          }}>
            <span aria-hidden style={{
              color: 'var(--text-faint)', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: Math.round(size * 0.4), lineHeight: 1,
            }}>+</span>
          </span>
        </span>
      </span>
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text-faint)',
      }}>미정</span>
    </div>
  );
}

function TeamCard({ team, accent }: { team: TeamVM; accent: string }) {
  const member = (m: { name: string; img?: string; resolved: boolean }, size: number, leader = false) => (
    <div key={`${m.name}-${leader}`} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0,
    }}>
      <HexAvatar name={m.name} imageUrl={m.img} size={size}
        ring={leader ? accent : `color-mix(in srgb, ${accent} 45%, var(--border-line))`}
        ringWidth={leader ? 3 : 2}
        imgStyle={m.resolved ? undefined : { filter: 'grayscale(1)' }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: size + 50 }}>
        {leader && (
          <span style={{
            flexShrink: 0, padding: '1px 7px', borderRadius: 'var(--r-pill)',
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
            color: accent, fontFamily: 'var(--font-numeral)', fontWeight: 700,
            fontSize: 10, letterSpacing: '0.08em',
          }}>팀장</span>
        )}
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: leader ? 800 : 600,
          fontSize: leader ? 'var(--fs-sm)' : 'var(--fs-xs)',
          color: m.resolved ? 'var(--text-high)' : 'var(--text-faint)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{m.name}</span>
      </span>
    </div>
  );

  return (
    // 로스터 카드는 세로가 길어져 상하 여백·간격만 sectionCard보다 좁게
    <section style={{ ...sectionCard, justifyItems: 'center', gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)', position: 'relative' }}>
      {/* 팀 이름 + 전적 요약 */}
      <div style={{ justifySelf: 'stretch', display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
        <h2 style={{ ...sectionTitle, color: accent }}>{team.name}</h2>
        <span style={sectionHint}>{team.captain.name}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-numeral)',
          fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {team.games ? `${team.wins}승 ${team.losses}패` : '경기 없음'}
        </span>
      </div>
      {member(team.captain, 60, true)}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {Array.from({ length: Math.max(MEMBER_SLOTS, team.members.length) }).map((_, i) => {
          const m = team.members[i];
          return (
            <span key={i} style={{ display: 'contents' }}>
              {m ? member(m, 48) : <EmptySlot size={48} accent={accent} />}
            </span>
          );
        })}
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, color: accent }}>{t.name}</span>
                        <HexAvatar name={t.captain.name} imageUrl={t.captain.img} ring={accent} size={22} />
                        <span style={sectionHint}>{t.captain.name}</span>
                      </span>
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

      {/* 팀별 맵 승률 매트릭스 */}
      <section style={sectionCard}>
        <h2 style={sectionTitle}>팀별 맵 승률</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', minWidth: 560 }}>
            <colgroup>
              <col style={{ width: 72 }} />
              {data.maps.map((m) => <col key={m.map} style={{ width: `calc((100% - 72px) / ${data.maps.length})` }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>팀 \ 맵</th>
              {data.maps.map((m) => (
                <th key={m.map} style={{ ...th, textAlign: 'center', whiteSpace: 'normal', wordBreak: 'keep-all' }}>{m.map}</th>
              ))}
            </tr></thead>
            <tbody>
              {teams.map((t, ri) => (
                <tr key={t.id}>
                  <td style={{ ...tdLeft, fontWeight: 800, color: TEAM_ACCENTS[ri % TEAM_ACCENTS.length] }}>
                    {t.name}
                  </td>
                  {data.maps.map((m, ci) => {
                    const cell = data.teamMaps[ri]?.[ci];
                    if (!cell || cell.games === 0) return (
                      <td key={m.map} style={{ ...td, textAlign: 'center', color: 'var(--text-faint)' }}>—</td>
                    );
                    const wr = cell.winRate!;
                    const bg = wr > 0.5 ? 'var(--win-soft)' : wr < 0.5 ? 'var(--loss-soft)' : 'transparent';
                    return (
                      <td key={m.map} style={{ ...td, textAlign: 'center', background: bg, padding: '8px' }}>
                        <span style={{ fontWeight: 800, color: rateColor(wr) }}>{pct(wr)}</span>
                        <span style={{ ...sectionHint, display: 'block', marginTop: 2 }}>
                          {cell.wins}/{cell.games}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span style={sectionHint}>맵별 팀 승률 · 아래는 승/경기. — = 해당 맵 미플레이.</span>
      </section>
    </div>
  );
}

// ── 탭 2: 경기 기록 ──────────────────────────────────────────

// 딜=블루, 힐=그린 막대. 딜/힐 공통 최대값(max) 기준 정규화, 헥스 쪽에서 바깥으로 뻗음.
function StatBar({ p, mirror, max }: { p: PlayerVM; mirror: boolean; max: number }) {
  if (p.barKind === undefined || p.barValue === undefined) {
    return <span style={{ flexShrink: 0, fontFamily: 'var(--font-numeral)', fontSize: 9,
      color: 'rgba(255,255,255,0.35)' }}>기록 없음</span>;
  }
  const w = max > 0 ? Math.round((p.barValue / max) * 100) : 0;
  const color = p.barKind === 'heal' ? 'var(--win)' : 'var(--cheese-blue)';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
      flexDirection: mirror ? 'row' : 'row-reverse' }}>
      <span style={{ position: 'relative', width: 72, height: 5,
        borderRadius: 999, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: 0, bottom: 0,
          [mirror ? 'left' : 'right']: 0, width: `${w}%`, background: color,
          borderRadius: 999 } as React.CSSProperties} />
      </span>
      <span style={{ flexShrink: 0, fontFamily: 'var(--font-numeral)', fontSize: 9, fontWeight: 700,
        color: 'rgba(255,255,255,0.8)', minWidth: 30, textAlign: mirror ? 'left' : 'right' }}>
        {p.barLabel}
      </span>
    </span>
  );
}

function PlayerRow({ p, mirror, max }: {
  p: PlayerVM; mirror: boolean; max: number;
}) {
  // 한 줄 고정 컬럼 배치 — 헥스(가운데)에서 바깥으로 닉네임 → KDA → 막대 순으로 뻗음.
  // 닉네임·KDA 컬럼 폭 고정 + 트랙을 헥스 쪽으로 밀착(justifyContent) → 남는 공간은 바깥쪽,
  // 행마다·양 팀 모두 KDA 시작지점 일치.
  // 용병(대타)은 이름 옆에 배지 — 이 팀 로스터 밖 출전자임을 표시
  const mercBadge = p.merc ? (
    <span title="용병 (팀 로스터 밖 출전)" style={{ flexShrink: 0,
      padding: '0 4px', borderRadius: 'var(--r-pill)',
      background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)',
      color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 8.5,
      lineHeight: '13px' }}>용병</span>
  ) : null;
  const name = (
    <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 3,
      justifyContent: mirror ? 'flex-start' : 'flex-end' }}>
      {mirror && mercBadge}
      <span title={p.gameName} style={{ minWidth: 0,
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--fs-xs)',
        color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
      {!mirror && mercBadge}
    </span>
  );
  const kda = p.kda ? (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap',
      // 고정 84px 셀 안에서 닉네임 쪽으로 밀착 — 닉네임↔KAD 간격이 양 팀 동일해지고
      // 남는 셀 여백은 막대 쪽으로 → KAD↔막대 거리도 좌우 일치
      justifySelf: mirror ? 'start' : 'end' }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 8.5,
        letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)' }}>KAD</span>
      <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 12.5,
        color: '#fff' }}>{p.kda}</span>
    </span>
  ) : <span />;
  const bar = <StatBar p={p} mirror={mirror} max={max} />;
  const info = (
    <span style={{ minWidth: 0, display: 'grid', alignItems: 'center', columnGap: 7,
      justifyContent: mirror ? 'start' : 'end',
      // 닉네임 컬럼은 용병 배지가 붙어도 이름이 뭉개지지 않을 만큼 확보 (양 팀 동일 폭 유지)
      gridTemplateColumns: mirror ? '78px 60px auto' : 'auto 60px 78px' }}>
      {mirror ? <>{name}{kda}{bar}</> : <>{bar}{kda}{name}</>}
    </span>
  );
  const hex = (
    <HexAvatar name={p.hero} imageUrl={heroImageUrl(p.hero)} size={34}
      ring="rgba(255,255,255,0.5)" />
  );
  return (
    <div style={{
      display: 'grid', gap: 'var(--sp-2)', alignItems: 'center',
      gridTemplateColumns: mirror ? '34px minmax(0, 1fr)' : 'minmax(0, 1fr) 34px',
    }}>
      {mirror ? <>{hex}{info}</> : <>{info}{hex}</>}
    </div>
  );
}

function SideBlock({ side, mirror, showFirstPick, max }: {
  side: SideVM; mirror: boolean; showFirstPick: boolean; max: number;
}) {
  return (
    <div style={{
      display: 'grid', gap: 6, alignContent: 'start', minWidth: 0,
      borderRadius: 'var(--r-md)', padding: '8px 10px',
      // 이긴 쪽은 초록 테두리만 (그라데이션 없음)
      border: side.won ? '1px solid color-mix(in srgb, var(--win) 55%, transparent)' : '1px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
        flexDirection: mirror ? 'row' : 'row-reverse' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-sm)', color: '#fff' }}>{side.teamName}</span>
        {side.won && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 18, padding: '0 7px', borderRadius: 999, background: 'var(--win)',
            color: 'var(--bg-void)', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 10 }}>승</span>
        )}
        {showFirstPick && side.firstPick && (
          <span style={{ padding: '1px 7px', borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.35)',
            color: '#fff', fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 9,
            letterSpacing: '0.08em' }}>선픽</span>
        )}
      </div>
      {side.players.map((p, i) => <PlayerRow key={i} p={p} mirror={mirror} max={max} />)}
    </div>
  );
}

function GameCard({ g, desktop }: { g: GameVM; desktop: boolean }) {
  return (
    <article style={{ position: 'relative', overflow: 'hidden', maxWidth: 880, margin: '0 auto', width: '100%',
      borderRadius: 'var(--r-lg)', border: '1px solid var(--border-line)' }}>
      {/* 배경 = 맵 이미지 (예시 이미지 규약) */}
      {g.mapImg && <Image src={g.mapImg} alt={g.map ?? ''} fill sizes="1100px"
        style={{ objectFit: 'cover', filter: 'brightness(0.55) saturate(0.85)' }} />}
      {!g.mapImg && <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--surface-card)' }} />}
      <span aria-hidden style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.65))' }} />

      <div style={{ position: 'relative', display: 'grid', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
        {/* 헤더: 날짜 · 스크림 번호 · 맵 · 시간 한 줄 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800,
            fontSize: 'var(--fs-xs)', color: 'var(--win)' }}>#{g.no}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'var(--fs-sm)', color: '#fff' }}>{g.map ?? '맵 미기록'}</span>
          {g.dur && (
            <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10,
              color: 'rgba(255,255,255,0.7)' }}>{g.dur}</span>
          )}
          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10,
            color: 'rgba(255,255,255,0.55)' }}>{g.dateLabel}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: 9,
            color: 'rgba(255,255,255,0.45)' }}>
            {g.firstPickKnown ? '왼쪽 선픽' : '선픽 미기록'}
          </span>
        </div>

        {/* 본문: 좌팀 | 우팀 (모바일은 세로 스택) */}
        <div style={{
          display: 'grid', gap: 'var(--sp-2)',
          gridTemplateColumns: desktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        }}>
          <SideBlock side={g.left} mirror={false} showFirstPick={g.firstPickKnown} max={Math.max(g.maxDmg, g.maxHeal)} />
          <SideBlock side={g.right} mirror showFirstPick={g.firstPickKnown} max={Math.max(g.maxDmg, g.maxHeal)} />
        </div>
      </div>
    </article>
  );
}

const GAMES_PER_PAGE = 8;

function GamesTab({ games: allGames, teams, desktop }: {
  games: GameVM[]; teams: TeamVM[]; desktop: boolean;
}) {
  const [page, setPage] = useState(1);
  // 팀 필터 — 그 팀이 어느 진영으로든 출전한 경기만. 팀 이름이 곧 SideVM.teamName.
  const [team, setTeam] = useState<string | null>(null);

  if (allGames.length === 0) {
    return <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
      분류된 대회 스크림이 없습니다. 내전기록실에 경기를 입력하면 팀 로스터 기준으로 자동 분류됩니다.
    </p>;
  }

  const games = team
    ? allGames.filter((g) => g.left.teamName === team || g.right.teamName === team)
    : allGames;
  const pages = Math.max(1, Math.ceil(games.length / GAMES_PER_PAGE));
  const cur = Math.min(page, pages); // 데이터 축소 시 범위 보정
  const start = (cur - 1) * GAMES_PER_PAGE;
  const shown = games.slice(start, start + GAMES_PER_PAGE);
  const goto = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {/* 팀 필터 — 전체 / 각 팀. 선택 팀이 참여한 경기만 남는다. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip label="전체" active={team === null} onClick={() => { setTeam(null); setPage(1); }} />
        {teams.map((t, i) => (
          <Chip key={t.id} label={t.name} active={team === t.name}
            accent={TEAM_ACCENTS[i % TEAM_ACCENTS.length]}
            title={t.captain.name}
            onClick={() => { setTeam(t.name); setPage(1); }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
        <span style={sectionHint}>총 {games.length}경기 · 최신순</span>
        {pages > 1 && <span style={sectionHint}>{cur} / {pages} 페이지</span>}
      </div>

      {games.length === 0 && (
        <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
          {team} 경기가 없습니다.
        </p>
      )}
      {shown.map((g) => <GameCard key={g.id} g={g} desktop={desktop} />)}

      {pages > 1 && (
        <nav style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 'var(--sp-2)' }}>
          <PageBtn label="‹" disabled={cur === 1} onClick={() => goto(cur - 1)} />
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <PageBtn key={p} label={String(p)} active={p === cur} onClick={() => goto(p)} />
          ))}
          <PageBtn label="›" disabled={cur === pages} onClick={() => goto(cur + 1)} />
        </nav>
      )}
    </div>
  );
}

function PageBtn({ label, active, disabled, onClick }: {
  label: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-current={active ? 'page' : undefined}
      style={{
        minWidth: 34, height: 34, padding: '0 8px', borderRadius: 'var(--r-sm)',
        border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
        background: active ? 'color-mix(in srgb, var(--cheese-green) 14%, transparent)' : 'transparent',
        color: disabled ? 'var(--text-faint)' : active ? 'var(--text-high)' : 'var(--text-muted)',
        fontFamily: 'var(--font-numeral)', fontWeight: active ? 800 : 600, fontSize: 'var(--fs-sm)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}>
      {label}
    </button>
  );
}

// ── 탭 3: 포지션 통계 ────────────────────────────────────────

// 지표 열 정의 — 전부 "높을수록 우수", 열 내 상대값으로 히트맵 색상.
type PosRow = TournamentData['positions'][number]['rows'][number];
// roles를 주면 그 포지션 표에서만 열이 보인다 (없으면 전 포지션 공통).
const POS_METRICS: {
  label: string; val: (r: PosRow) => number | null; fmt: (r: PosRow) => string; roles?: Role[];
}[] = [
  { label: '승률',     val: (r) => r.winRate,        fmt: (r) => pct(r.winRate) },
  { label: 'KDA',      val: (r) => r.kda,            fmt: (r) => fmt1(r.kda) },
  { label: '킬관여율',  val: (r) => r.kp,             fmt: (r) => (r.kp === null ? '—' : pct(r.kp)) },
  { label: '영웅딜/분', val: (r) => r.heroDmgPerMin,  fmt: (r) => fmtInt(r.heroDmgPerMin) },
  { label: '공성딜/분', val: (r) => r.siegeDmgPerMin, fmt: (r) => fmtInt(r.siegeDmgPerMin) },
  // 힐은 지원가만, 자힐은 그 외 포지션만 — 서로 무의미한 열이라 숨긴다
  { label: '힐/분',    val: (r) => r.healingPerMin,  fmt: (r) => fmtInt(r.healingPerMin),
    roles: ['지원가'] },
  { label: '자힐/분',   val: (r) => r.selfHealPerMin, fmt: (r) => fmtInt(r.selfHealPerMin),
    roles: POSITION_ORDER.filter((r) => r !== '지원가') },
  { label: 'XP 지분',  val: (r) => r.xpShare,        fmt: (r) => (r.xpShare === null ? '—' : pct(r.xpShare)) },
];

// 열 내 상대값(0~1)을 배경 틴트로 — 높으면 파랑, 낮으면 빨강 (스크린샷 규약).
function heatBg(value: number | null, min: number, max: number): string {
  if (value === null || max <= min) return 'transparent';
  const norm = (value - min) / (max - min); // 0~1
  const MAX_ALPHA = 26;
  if (norm >= 0.5) {
    const a = Math.round((norm - 0.5) * 2 * MAX_ALPHA);
    return `color-mix(in srgb, var(--cheese-blue) ${a}%, transparent)`;
  }
  const a = Math.round((0.5 - norm) * 2 * MAX_ALPHA);
  return `color-mix(in srgb, var(--loss) ${a}%, transparent)`;
}

// 포지션 표 고정 열 폭 — 표마다 이름 길이가 달라도 열이 어긋나지 않게 고정.
// 아바타 36 + 간격 10 + 가장 긴 닉네임 기준.
const NAME_COL_W = 168;
const TEAM_COL_W = 104;
const RECORD_COL_W = 78;
const MOST_COL_W = 92;

// 포지션 표 전용 셀 — 지표 열이 많아 공용 td/th보다 글자만 키운다 (여백은 그대로)
const posTh: CSSProperties = { ...th, fontSize: 'var(--fs-xs)' };
const posTd: CSSProperties = { ...td, fontSize: 'var(--fs-md)' };
const posTdLeft: CSSProperties = { ...posTd, textAlign: 'left', fontFamily: 'var(--font-ui)' };

function PositionsTab({ data }: { data: TournamentData }) {
  if (data.positions.length === 0) {
    return <p style={{ ...sectionCard, ...sectionHint, display: 'block' }}>
      집계할 경기가 없습니다.
    </p>;
  }
  // 팀 이름 → 팀장 이름 (팀 열 부제) · 팀 이름 → 액센트 색(아바타 테두리, 팀 카드·표와 동일 배정)
  const captainOf = new Map(data.teams.map((t) => [t.name, t.captain.name]));
  const accentOf = new Map(data.teams.map((t, i) => [t.name, TEAM_ACCENTS[i % TEAM_ACCENTS.length]]));
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      {data.positions.map(({ role, rows }) => {
        const metrics = POS_METRICS.filter((m) => !m.roles || m.roles.includes(role));
        // 열별 min/max 사전계산 — 셀 히트맵 기준
        const range = metrics.map((m) => {
          const vals = rows.map(m.val).filter((v): v is number => v !== null);
          return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 0 };
        });
        return (
          <section key={role} style={sectionCard}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
              <h2 style={sectionTitle}>{role}</h2>
              <span style={sectionHint}>/분 지표는 경기시간 기록된 경기만 집계 · 색은 열 내 상대값</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                {/* 이름·팀 열은 포지션마다 폭이 달라지지 않게 고정 — 표끼리 세로로 정렬된다 */}
                <colgroup>
                  <col style={{ width: NAME_COL_W }} />
                  <col style={{ width: TEAM_COL_W }} />
                  <col style={{ width: RECORD_COL_W }} />
                  <col style={{ width: MOST_COL_W }} />
                  {metrics.map((m) => <col key={m.label} />)}
                </colgroup>
                <thead><tr>
                  <th style={{ ...posTh, textAlign: 'left' }}>스트리머</th>
                  <th style={{ ...posTh, textAlign: 'left' }}>팀</th>
                  <th style={posTh}>전적</th>
                  <th style={posTh}>모스트</th>
                  {metrics.map((m) => <th key={m.label} style={posTh}>{m.label}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const captain = captainOf.get(r.teamName);
                    const accent = accentOf.get(r.teamName) ?? 'var(--border-strong)'; // 용병 등 미소속은 중립색
                    return (
                      <tr key={r.name} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-line) 55%, transparent)' }}>
                        <td style={posTdLeft}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <HexAvatar name={r.name} imageUrl={r.img} ring={accent} ringWidth={2} size={36} />
                            <span style={{ fontWeight: 700, color: 'var(--text-high)',
                              overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                          </span>
                        </td>
                        <td style={{ ...posTdLeft, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ fontWeight: 700, color: accent }}>{r.teamName}</span>
                          {captain && <span style={{ ...sectionHint, marginLeft: 6 }}>{captain}</span>}
                        </td>
                        <td style={posTd}>
                          <span style={{ color: 'var(--win)' }}>{r.wins}승</span>/{r.games}
                        </td>
                        <td style={{ ...posTd, textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {r.topHeroes.map((h, hi) => (
                              <span key={h} title={h} style={{ display: 'flex', marginLeft: hi === 0 ? 0 : -6 }}>
                                <HexAvatar name={h} imageUrl={heroImageUrl(h)}
                                  ring="var(--border-strong)" ringWidth={1.5} size={26} />
                              </span>
                            ))}
                          </span>
                        </td>
                        {metrics.map((m, ci) => {
                          // 승률은 배경 히트맵 대신, 역할군 내 최고=그린·최하=레드 글자색만
                          const isWinRate = m.label === '승률';
                          let color = 'var(--text-high)';
                          if (isWinRate && range[ci].max > range[ci].min) {
                            if (r.winRate === range[ci].max) color = 'var(--win)';
                            else if (r.winRate === range[ci].min) color = 'var(--loss)';
                          }
                          return (
                            <td key={m.label} style={{
                              ...posTd, fontWeight: isWinRate || m.label === 'KDA' ? 800 : 600,
                              color,
                              background: isWinRate ? 'transparent' : heatBg(m.val(r), range[ci].min, range[ci].max),
                            }}>
                              {m.fmt(r)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
