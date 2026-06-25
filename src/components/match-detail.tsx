'use client';

import { statOf, displaySides } from '@/lib/match';
import type { Match, PlayerMatchStat, Streamer } from '@/lib/types';
import { HexAvatar } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import { useBreakpoint } from '@/hooks/use-breakpoint';

// 영웅 육각 프로필 — 육각형 + 보라 테두리. 영웅 사진 있으면 표시, 없으면 이니셜 폴백.
export function HeroHex({ hero, size = 30 }: { hero: string; size?: number }) {
  return <HexAvatar name={hero} imageUrl={heroImageUrl(hero)} ring="var(--hots-purple)" size={size} ringWidth={1.5} />;
}

// 한 팀의 사용 영웅 육각 스택 — 승리 팀은 강조, 패배 팀은 디밍 (팀 색깔 없음)
// glow=true (접힘 상태): '승' 글자 대신 컬러 블러 그림자로 승리팀 강조
export function HeroTeamStack({ heroes, won, size = 30, glow = false }:
  { heroes: string[]; won: boolean; size?: number; glow?: boolean }) {
  const showWinText = won && !glow;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0,
      padding: showWinText ? '3px 9px 3px 5px' : '3px 5px',
      borderRadius: 'var(--r-pill)',
      // 비-글로우(상세 헤더)만 배경 유지. 글로우(목록)는 알약 배경/테두리 없음.
      background: showWinText ? 'var(--win-soft)' : 'transparent',
      // 접힘 상태 승리팀 강조: 알약 대신 헥사곤에 직접 초록 블러 글로우 (패배팀 디밍 없음)
      filter: glow && won
        ? 'drop-shadow(0 0 7px color-mix(in srgb, var(--win) 70%, transparent))'
        : 'none',
    }}>
      {heroes.map((h, i) => (
        <span key={i} title={h} style={{ display: 'flex', marginLeft: i === 0 ? 0 : -7 }}>
          <HeroHex hero={h} size={size} />
        </span>
      ))}
      {showWinText && (
        <span style={{ marginLeft: 7, fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 12, color: 'var(--win)', letterSpacing: '0.04em' }}>승</span>
      )}
    </div>
  );
}

// 스탯표 8열 그리드 — 라벨행과 StatRow가 공유. 모바일은 폭 축소(배틀ID·영웅명 제거).
// 프사 | 이름 | 영웅 | K/A/D | 영웅딜 | 공성딜 | 힐/자힐 | 경험치
const GRID_COLS_DESKTOP = '52px 1fr 1fr 60px 58px 58px 66px 58px';
const GRID_COLS_MOBILE = '36px 60px 30px 52px 50px 50px 56px 50px';

// 숫자를 k 단위로 축약 (예: 12345 → 12.3k)
function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// 팀 내 최고값(영웅딜·공성딜·경험치) — 해당 셀을 강조하기 위한 기준값
type TeamTops = { heroDmg: number; siegeDmg: number; xp: number };

// 스탯 막대 셀 — 숫자(크게) + 아래 얇은 막대(팀 최고값 대비 비율). 영웅딜·공성딜·경험치용.
function StatBarCell({ value, max, highlight }: { value: number | null; max: number; highlight: boolean }) {
  const ratio = value != null && max > 0 ? Math.min(value / max, 1) : 0;
  const color = highlight ? 'var(--cheese-green)' : 'var(--text-high)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, paddingLeft: 6 }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 16, fontWeight: highlight ? 800 : 600,
        color, textAlign: 'left', lineHeight: 1 }}>
        {value != null ? fmtNum(value) : '—'}
      </span>
      <div style={{ height: 3, borderRadius: 999, background: 'var(--surface-raise)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', borderRadius: 999,
          background: highlight ? 'var(--cheese-green)' : 'var(--ink-500)' }} />
      </div>
    </div>
  );
}

// 막대 없는 숫자 셀 (K/A/D·힐) — 막대 셀과 높이를 맞추기 위해 하단 3px placeholder
function StatNumCell({ display, color, align = 'right', size = 16 }: {
  display: string; color: string; align?: 'center' | 'right' | 'left'; size?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4,
      paddingLeft: align === 'center' ? 0 : 6 }}>
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: size, fontWeight: 700,
        color, textAlign: align, lineHeight: 1 }}>
        {display}
      </span>
      <div style={{ height: 3 }} />
    </div>
  );
}

// ── StatRow ────────────────────────────────────────────────────
// 플레이어 한 줄 — 프사·이름·영웅 + 개인 스탯 셀
function StatRow({
  id, hero, stat, won, getName, gameName, imageUrl, tops, isMobile,
}: {
  id: string; hero: string; stat: PlayerMatchStat | null;
  won: boolean;
  getName: (id: string) => string;
  gameName?: string;
  imageUrl?: string;
  tops: TeamTops;
  isMobile: boolean;
}) {
  // 팀 최고값과 같으면(0 초과) 초록으로 강조
  const isTop = (key: keyof TeamTops) =>
    !!stat && tops[key] > 0 && stat[key] === tops[key];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? GRID_COLS_MOBILE : GRID_COLS_DESKTOP,
      alignItems: 'center', gap: 0,
      minHeight: isMobile ? 44 : 56, padding: isMobile ? '0 8px' : '0 12px',
      borderRadius: 'var(--r-sm)', background: 'var(--surface-card)',
      // 팀 색깔 없음 — 이긴 행만 win 색 좌측바로 강조
      borderLeft: `3px solid ${won ? 'var(--win)' : 'var(--border-line)'}`,
    }}>
      {/* 스트리머 육각 프사 — Nexus 보라 테두리. 모바일은 축소 */}
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <HexAvatar name={getName(id)} imageUrl={imageUrl} ring="var(--hots-purple)"
          size={isMobile ? 30 : 48} ringWidth={1.5} />
      </span>

      {/* 이름 (+ 배틀넷 아이디 — 모바일에선 숨김). 이름은 잘리지 않게 전체 표시(줄바꿈 허용) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0,
        paddingLeft: 4, paddingRight: 6 }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: isMobile ? 10.5 : 12.5,
          color: 'var(--text-high)', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          {getName(id)}
        </span>
        {gameName && !isMobile && (
          <span style={{
            fontFamily: 'var(--font-numeral)', fontSize: 10.5,
            color: 'var(--text-faint)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {gameName}
          </span>
        )}
      </div>

      {/* 영웅 — 육각 프로필 (+ 이름 — 모바일에선 숨김) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        overflow: 'hidden', paddingRight: isMobile ? 0 : 6 }}>
        <HeroHex hero={hero} size={isMobile ? 26 : 30} />
        {!isMobile && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 10.5, fontWeight: 600,
            color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {hero || '—'}
          </span>
        )}
      </div>

      {/* K/A/D — 중요 정보 (막대 없음) */}
      <StatNumCell align="center" size={14.5} color="var(--text-high)"
        display={stat ? `${stat.kills}/${stat.assists}/${stat.deaths}` : '—'} />

      {/* 영웅딜 — 비율 막대 + 팀 최고 강조 */}
      <StatBarCell value={stat ? stat.heroDmg : null} max={tops.heroDmg} highlight={isTop('heroDmg')} />

      {/* 공성딜 — 비율 막대 + 팀 최고 강조 */}
      <StatBarCell value={stat ? stat.siegeDmg : null} max={tops.siegeDmg} highlight={isTop('siegeDmg')} />

      {/* 힐 / 자힐 — 힐을 크게, 자힐을 아래 작게 표시 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 6 }}>
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 16, fontWeight: 700, lineHeight: 1,
          color: stat && stat.healing > 0 ? 'var(--text-high)' : 'var(--text-faint)' }}>
          {stat ? fmtNum(stat.healing) : '—'}
        </span>
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap',
          color: stat && stat.selfHeal > 0 ? 'var(--text-muted)' : 'var(--text-faint)' }}>
          {stat && stat.selfHeal > 0 ? `자힐 ${fmtNum(stat.selfHeal)}` : ''}
        </span>
      </div>

      {/* 경험치 — 비율 막대 + 팀 최고 강조 */}
      <StatBarCell value={stat ? stat.xp : null} max={tops.xp} highlight={isTop('xp')} />
    </div>
  );
}

// ── TeamStatBlock ─────────────────────────────────────────────
// 팀 한 블록: 헤더 + 컬럼 레이블 + StatRow 목록
function TeamStatBlock({
  roster, won, hasStats, level, getName, getGameName, getImage, match, side, isMobile,
}: {
  roster: [string, string][];
  won: boolean; hasStats: boolean;
  level?: number;
  getName: (id: string) => string;
  getGameName: (id: string) => string | undefined;
  getImage: (id: string) => string | undefined;
  match: Match;
  side: 'left' | 'right';
  isMobile: boolean;
}) {
  // 팀 내 최고값(영웅딜·공성딜·경험치) 계산 → 해당 셀 강조 기준
  const rowStats = roster.map(([id]) => statOf(match, id));
  const maxOf = (key: keyof TeamTops) =>
    rowStats.reduce((m, s) => (s ? Math.max(m, s[key]) : m), 0);
  const tops: TeamTops = { heroDmg: maxOf('heroDmg'), siegeDmg: maxOf('siegeDmg'), xp: maxOf('xp') };

  // 최종 레벨 — 라벨 없이 숫자만 (왼쪽 팀은 왼쪽, 오른쪽 팀은 오른쪽)
  const levelEl = level != null ? (
    <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 26,
      color: 'var(--text-high)', lineHeight: 1 }}>{level}</span>
  ) : <span />;
  const badgeEl = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
      borderRadius: 'var(--r-xs)',
      background: won ? 'color-mix(in srgb, var(--win) 16%, transparent)' : 'transparent',
      border: `1px solid ${won ? 'color-mix(in srgb, var(--win) 40%, transparent)' : 'var(--border-line)'}`,
      color: won ? 'var(--win)' : 'var(--text-faint)',
      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em',
    }}>{won ? '승리' : '패배'}</span>
  );

  // 팀 색깔(블루/레드) 없음 — 이긴 쪽만 win 색으로 강조, 진 쪽은 중립.
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: won ? 'var(--win-soft)' : 'transparent',
      border: `1px solid ${won
        ? 'color-mix(in srgb, var(--win) 32%, transparent)'
        : 'var(--border-faint)'}`,
      borderRadius: 'var(--r-sm)', padding: 'var(--sp-3)',
    }}>
      {/* 헤더: 승리/패배 강조 + 최종 레벨(라벨 없이 숫자만).
          왼쪽 팀은 레벨을 왼쪽에, 오른쪽 팀은 오른쪽에 배치 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--sp-3)' }}>
        {side === 'left' ? <>{badgeEl}{levelEl}</> : <>{levelEl}{badgeEl}</>}
      </div>

      {/* 모바일: 고정폭 8열 그리드가 폰 너비 초과 → 가로 스크롤로 형태 유지 */}
      <div style={isMobile ? { overflowX: 'auto', overflowY: 'hidden' } : undefined}>
      <div style={isMobile ? { minWidth: 400 } : undefined}>
      {/* 컬럼 레이블 (스탯 있을 때만) — StatRow와 동일한 8열 그리드 */}
      {hasStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? GRID_COLS_MOBILE : GRID_COLS_DESKTOP,
          padding: isMobile ? '0 8px' : '0 12px', marginBottom: 4,
        }}>
          <span />
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            paddingLeft: 4 }}>이름</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'center' }}>영웅</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'center' }}>K/A/D</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'left', paddingLeft: 6 }}>영웅딜</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'left', paddingLeft: 6 }}>공성딜</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'left', paddingLeft: 6 }}>힐 / 자힐</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'left', paddingLeft: 6 }}>경험치</span>
        </div>
      )}

      {/* 플레이어 행 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {roster.map(([id, hero]) => (
          <StatRow
            key={id}
            id={id}
            hero={hero}
            stat={statOf(match, id)}
            won={won}
            getName={getName}
            gameName={getGameName(id)}
            imageUrl={getImage(id)}
            tops={tops}
            isMobile={isMobile}
          />
        ))}
      </div>
      </div>
      </div>

      {/* 스탯 없는 경기 안내 */}
      {!hasStats && (
        <p style={{
          marginTop: 'var(--sp-3)',
          fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-faint)',
          textAlign: 'center',
        }}>
          데이터 부족
        </p>
      )}
    </div>
  );
}

// ── MatchDetail ───────────────────────────────────────────────
// 한 경기의 팀별 로스터·개인 스탯 상세. 목록 펼침·경기 상세 페이지에서 공용.
export function MatchDetail({ match, streamers }: { match: Match; streamers: Streamer[] }) {
  const isMobile = useBreakpoint() === 'mobile';
  // blueStats/redStats 중 하나라도 있으면 스탯 있음으로 판단
  const hasStats = !!(match.blueStats?.length || match.redStats?.length);

  const nameMap = new Map(streamers.map((s) => [s.id, s.name]));
  const gameMap = new Map(
    streamers.filter((s) => s.gameNames?.length).map((s) => [s.id, s.gameNames![0]]),
  );
  const imageMap = new Map(
    streamers.filter((s) => s.profileImageUrl).map((s) => [s.id, s.profileImageUrl!]),
  );
  const getName = (id: string) => nameMap.get(id) ?? id.replace('__unknown__', '');
  const getGameName = (id: string) => gameMap.get(id);
  const getImage = (id: string) => imageMap.get(id);
  const { left, right } = displaySides(match);

  return (
    <div style={{ padding: 'var(--sp-4) var(--sp-5) var(--sp-5)',
      borderTop: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        gap: 'var(--sp-4)', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
        <TeamStatBlock
          roster={left.roster}
          won={left.won}
          hasStats={hasStats}
          level={left.level}
          getName={getName}
          getGameName={getGameName}
          getImage={getImage}
          match={match}
          side="left"
          isMobile={isMobile}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          alignSelf: isMobile ? 'center' : 'stretch', paddingTop: isMobile ? 0 : 18 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
        </div>
        <TeamStatBlock
          roster={right.roster}
          won={right.won}
          hasStats={hasStats}
          level={right.level}
          getName={getName}
          getGameName={getGameName}
          getImage={getImage}
          match={match}
          side="right"
          isMobile={isMobile}
        />
      </div>
      {match.note && (
        <p style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)',
          borderTop: '1px solid var(--border-faint)',
          fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
          {match.note}
        </p>
      )}
    </div>
  );
}
