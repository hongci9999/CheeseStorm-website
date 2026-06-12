import { statOf } from '@/lib/match';
import type { Match, PlayerMatchStat, Streamer } from '@/lib/types';
import { HexAvatar } from '@/components/hexagon-avatar';

// 영웅 육각 프로필 — 스트리머 프로필과 동일한 육각형, 보라 테두리. 사진 없으니 이니셜 폴백.
export function HeroHex({ hero, size = 30 }: { hero: string; size?: number }) {
  return <HexAvatar name={hero} ring="var(--hots-purple)" size={size} ringWidth={1.5} />;
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

// 숫자를 k 단위로 축약 (예: 12345 → 12.3k)
function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── StatRow ────────────────────────────────────────────────────
// 플레이어 한 줄 — 이름·영웅 + 개인 스탯 셀
function StatRow({
  id, hero, stat, won, getName, gameName,
}: {
  id: string; hero: string; stat: PlayerMatchStat | null;
  won: boolean;
  getName: (id: string) => string;
  gameName?: string;
}) {
  return (
    <div style={{
      display: 'grid',
      // 이름+배틀태그 | 영웅(육각+이름) | K/A/D | 영웅딜 | 공성딜 | 힐 | 경험치
      gridTemplateColumns: '1.2fr 1.3fr 72px 72px 72px 72px 72px',
      alignItems: 'center', gap: 0,
      minHeight: 52, padding: '0 12px',
      borderRadius: 'var(--r-sm)', background: 'var(--surface-card)',
      // 팀 색깔 없음 — 이긴 행만 win 색 좌측바로 강조
      borderLeft: `3px solid ${won ? 'var(--win)' : 'var(--border-line)'}`,
      fontSize: 12.5,
    }}>
      {/* 이름 + 배틀넷 아이디(흐릿하게) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden', paddingRight: 6 }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5,
          color: 'var(--text-high)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getName(id)}
        </span>
        {gameName && (
          <span style={{
            fontFamily: 'var(--font-numeral)', fontSize: 10.5,
            color: 'var(--text-faint)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {gameName}
          </span>
        )}
      </div>

      {/* 영웅 — 육각 프로필 + 이름 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden', paddingRight: 6 }}>
        <HeroHex hero={hero} size={26} />
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600,
          color: 'var(--text-high)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {hero || '—'}
        </span>
      </div>

      {/* K/A/D — 중요 정보 */}
      <span style={{
        fontFamily: 'var(--font-numeral)', fontSize: 14, fontWeight: 700,
        color: 'var(--text-high)', textAlign: 'center',
      }}>
        {stat ? `${stat.kills}/${stat.assists}/${stat.deaths}` : '—'}
      </span>

      {/* 영웅딜 — 중요 스탯 */}
      <span style={{
        fontFamily: 'var(--font-numeral)', fontSize: 13.5, fontWeight: 600,
        color: 'var(--text-high)', textAlign: 'right',
      }}>
        {stat ? fmtNum(stat.heroDmg) : '—'}
      </span>

      {/* 공성딜 — 중요 스탯 */}
      <span style={{
        fontFamily: 'var(--font-numeral)', fontSize: 13.5, fontWeight: 600,
        color: 'var(--text-high)', textAlign: 'right',
      }}>
        {stat ? fmtNum(stat.siegeDmg) : '—'}
      </span>

      {/* 힐 — 중요 스탯 */}
      <span style={{
        fontFamily: 'var(--font-numeral)', fontSize: 13.5, fontWeight: 600,
        color: stat && stat.healing > 0 ? 'var(--cheese-green)' : 'var(--text-faint)',
        textAlign: 'right',
      }}>
        {stat ? fmtNum(stat.healing) : '—'}
      </span>

      {/* 경험치 */}
      <span style={{
        fontFamily: 'var(--font-numeral)', fontSize: 13.5, fontWeight: 600,
        color: 'var(--text-high)', textAlign: 'right',
      }}>
        {stat ? fmtNum(stat.xp) : '—'}
      </span>
    </div>
  );
}

// ── TeamStatBlock ─────────────────────────────────────────────
// 팀 한 블록: 헤더 + 컬럼 레이블 + StatRow 목록
function TeamStatBlock({
  roster, won, hasStats, level, getName, getGameName, match,
}: {
  roster: [string, string][];
  won: boolean; hasStats: boolean;
  level?: number;
  getName: (id: string) => string;
  getGameName: (id: string) => string | undefined;
  match: Match;
}) {
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
      {/* 헤더: 승리/패배 강조 + 최종 레벨(크게) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--sp-3)' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
          borderRadius: 'var(--r-xs)',
          background: won ? 'color-mix(in srgb, var(--win) 16%, transparent)' : 'transparent',
          border: `1px solid ${won ? 'color-mix(in srgb, var(--win) 40%, transparent)' : 'var(--border-line)'}`,
          color: won ? 'var(--win)' : 'var(--text-faint)',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em',
        }}>{won ? '승리' : '패배'}</span>
        {level != null && (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, letterSpacing: '0.08em',
              color: 'var(--text-faint)', textTransform: 'uppercase' }}>최종 레벨</span>
            <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 26,
              color: 'var(--text-high)', lineHeight: 1 }}>{level}</span>
          </span>
        )}
      </div>

      {/* 컬럼 레이블 (스탯 있을 때만) */}
      {hasStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.3fr 72px 72px 72px 72px 72px',
          padding: '0 12px', marginBottom: 4,
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)' }}>이름</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)' }}>영웅</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'center' }}>K/A/D</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'right' }}>영웅딜</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'right' }}>공성딜</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'right' }}>힐</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-faint)',
            textAlign: 'right' }}>경험치</span>
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
          />
        ))}
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
  // blueStats/redStats 중 하나라도 있으면 스탯 있음으로 판단
  const hasStats = !!(match.blueStats?.length || match.redStats?.length);

  const nameMap = new Map(streamers.map((s) => [s.id, s.name]));
  const gameMap = new Map(
    streamers.filter((s) => s.gameNames?.length).map((s) => [s.id, s.gameNames![0]]),
  );
  const getName = (id: string) => nameMap.get(id) ?? id.replace('__unknown__', '');
  const getGameName = (id: string) => gameMap.get(id);

  return (
    <div style={{ padding: 'var(--sp-4) var(--sp-5) var(--sp-5)',
      borderTop: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
        <TeamStatBlock
          roster={match.blueTeam}
          won={match.winner === 'blue'}
          hasStats={hasStats}
          level={match.blueLevel}
          getName={getName}
          getGameName={getGameName}
          match={match}
        />
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', paddingTop: 18 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
        </div>
        <TeamStatBlock
          roster={match.redTeam}
          won={match.winner === 'red'}
          hasStats={hasStats}
          level={match.redLevel}
          getName={getName}
          getGameName={getGameName}
          match={match}
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
