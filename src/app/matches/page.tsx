'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMatches, getStreamers, deleteMatch, isFirebaseConfigured } from '@/lib/firestore';
import { participants, statOf } from '@/lib/match';
import type { Match, PlayerMatchStat } from '@/lib/types';
import { MOCK_MATCHES, MOCK_STREAMERS } from '@/test/fixtures';
import { HexAvatar } from '@/components/hexagon-avatar';

// 영웅 육각 프로필 — 스트리머 프로필과 동일한 육각형, 보라 테두리. 사진 없으니 이니셜 폴백.
function HeroHex({ hero, size = 30 }: { hero: string; size?: number }) {
  return <HexAvatar name={hero} ring="var(--hots-purple)" size={size} ringWidth={1.5} />;
}

// 한 팀의 사용 영웅 육각 스택 — 승리 팀은 강조, 패배 팀은 디밍 (팀 색깔 없음)
function HeroTeamStack({ heroes, won, size = 30 }: { heroes: string[]; won: boolean; size?: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0,
      padding: won ? '3px 9px 3px 5px' : '3px 5px',
      borderRadius: 'var(--r-pill)',
      background: won ? 'var(--win-soft)' : 'transparent',
      border: `1px solid ${won ? 'color-mix(in srgb, var(--win) 35%, transparent)' : 'transparent'}`,
      opacity: won ? 1 : 0.5,
    }}>
      {heroes.map((h, i) => (
        <span key={i} title={h} style={{ marginLeft: i === 0 ? 0 : -7 }}>
          <HeroHex hero={h} size={size} />
        </span>
      ))}
      {won && (
        <span style={{ marginLeft: 7, fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 12, color: 'var(--win)', letterSpacing: '0.04em' }}>승</span>
      )}
    </div>
  );
}

// ── 헬퍼 ─────────────────────────────────────────────────────
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function relativeDate(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function groupByDate(matches: Match[]): [string, Match[]][] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const k = dateKey(m.date);
    const g = map.get(k) ?? [];
    g.push(m);
    map.set(k, g);
  }
  return [...map.entries()];
}

// 숫자를 k 단위로 축약 (예: 12345 → 12.3k)
function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── MatchFilters ──────────────────────────────────────────────
// 분류 탭(팀1 승/팀2 승)은 제거됨 — 검색창만 유지

function MatchFilters({
  search, onSearch,
}: {
  search: string; onSearch: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
      {/* 검색 */}
      <div style={{ position: 'relative', width: 260 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }}>⌕</span>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="선수 · 영웅 · 맵 검색"
          style={{
            width: '100%', height: 40, paddingLeft: 36, paddingRight: 12,
            borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
            background: 'var(--surface-input)', color: 'var(--text-high)',
            fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 전적 등록 버튼 */}
      <Link href="/matches/new" style={{
        marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 40, padding: '0 var(--sp-4)',
        borderRadius: 'var(--r-sm)', background: 'var(--cheese-green)',
        color: 'var(--text-on-green)', fontFamily: 'var(--font-ui)',
        fontWeight: 700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap',
        transition: `background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
      }}>
        ＋ 전적 등록
      </Link>
    </div>
  );
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
      // 이름+배틀태그 | 영웅(육각+이름) | K/A/D | 영웅딜 | 공성딜 | 힐
      gridTemplateColumns: '1.2fr 1.3fr 72px 72px 72px 72px',
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
          gridTemplateColumns: '1.2fr 1.3fr 72px 72px 72px 72px',
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
function MatchDetail({ match, getName, getGameName }: {
  match: Match; getName: (id: string) => string; getGameName: (id: string) => string | undefined;
}) {
  // blueStats/redStats 중 하나라도 있으면 스탯 있음으로 판단
  const hasStats = !!(match.blueStats?.length || match.redStats?.length);

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

// ── MatchRow (카드 헤더) ───────────────────────────────────────
function MatchRow({
  match, open, idx, onClick, onDelete,
}: {
  match: Match; open: boolean; idx: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const blueWon = match.winner === 'blue';
  const blueHeroes = match.blueTeam.map(([, h]) => h);
  const redHeroes  = match.redTeam.map(([, h]) => h);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minHeight: 68,
      padding: '0 var(--sp-4)', cursor: 'pointer',
      background: open ? 'var(--grad-sweep)' : 'transparent',
      transition: 'background var(--dur-fast) var(--ease-out)',
    }}
      onClick={onClick}
    >
      {/* 일련번호 */}
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5, color: 'var(--text-faint)',
        width: 32, letterSpacing: '0.04em', flexShrink: 0 }}>
        #{idx}
      </span>

      {/* 영웅 프로필 VS — 이긴 쪽 강조 (팀 색깔 없음) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <HeroTeamStack heroes={blueHeroes} won={blueWon} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
          color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
        <HeroTeamStack heroes={redHeroes} won={!blueWon} />
      </div>

      {/* 맵 (전장) — VS 다음 */}
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
        color: 'var(--text-high)', flex: 1, marginLeft: 'var(--sp-2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {match.map ?? '—'}
      </span>

      {/* 경기 시간 */}
      {match.dur && (
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12.5, color: 'var(--text-muted)',
          whiteSpace: 'nowrap', flexShrink: 0 }}>
          {match.dur}
        </span>
      )}

      {/* 날짜 */}
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5, color: 'var(--text-faint)',
        width: 44, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {relativeDate(match.date)}
      </span>

      {/* 삭제 */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
          borderRadius: 'var(--r-xs)', color: 'var(--text-faint)', fontSize: 11,
          flexShrink: 0, transition: 'color var(--dur-fast) var(--ease-out)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
      >
        ✕
      </button>

      {/* 펼침 화살표 */}
      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0,
        transition: `transform var(--dur-fast) var(--ease-out)`,
        transform: open ? 'rotate(180deg)' : 'none',
      }}>▾</span>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function MatchesPage() {
  const [matches,   setMatches]   = useState<Match[]>([]);
  const [nameMap,   setNameMap]   = useState<Map<string, string>>(new Map());
  const [gameMap,   setGameMap]   = useState<Map<string, string>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [openId,    setOpenId]    = useState<string | null>(null);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    async function load() {
      const sl = isFirebaseConfigured ? await getStreamers() : MOCK_STREAMERS;
      const ml = isFirebaseConfigured ? await getMatches() : MOCK_MATCHES;
      setMatches(ml);
      setNameMap(new Map(sl.map(s => [s.id, s.name])));
      // 배틀태그(gameNames 첫 항목) — 펼침 스탯행 이름 밑에 흐릿하게 표시
      setGameMap(new Map(sl.filter(s => s.gameNames?.length).map(s => [s.id, s.gameNames![0]])));
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('이 경기를 삭제하시겠습니까?')) return;
    await deleteMatch(id);
    setMatches(prev => prev.filter(m => m.id !== id));
    if (openId === id) setOpenId(null);
  }

  const getName = (id: string) => nameMap.get(id) ?? id.replace('__unknown__', '');
  const getGameName = (id: string) => gameMap.get(id);

  // 검색 필터 (분류 탭 제거 — 검색만 유지)
  const filtered = matches.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      const players = participants(m);
      const matchesPlayer = players.some(([id, hero]) =>
        getName(id).toLowerCase().includes(q) || hero.toLowerCase().includes(q)
      );
      const matchesMap = m.map?.toLowerCase().includes(q);
      if (!matchesPlayer && !matchesMap) return false;
    }
    return true;
  });

  const groups = groupByDate(filtered);

  if (loading) return (
    <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 80 }}>
      불러오는 중...
    </div>
  );

  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-3xl)',
          color: 'var(--text-strong)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0 }}>
          내전기록실
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          MATCH ROOM · {matches.length}경기 기록됨
        </p>
      </div>

      <MatchFilters
        search={search} onSearch={setSearch}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60,
          fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          {search ? '검색 결과가 없습니다.' : '아직 집계된 내전이 없습니다.'}
        </div>
      ) : (
        /* 타임라인 */
        <div style={{ position: 'relative', paddingLeft: 'var(--sp-6)' }}>
          {/* 타임라인 레일 */}
          <span style={{ position: 'absolute', left: 7, top: 8, bottom: 8,
            width: 2, background: 'var(--border-line)' }} />

          {groups.map(([date, list]) => (
            <div key={date} style={{ marginBottom: 'var(--sp-6)' }}>
              {/* 날짜 노드 */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
                gap: 10, marginBottom: 'var(--sp-4)' }}>
                <span style={{
                  position: 'absolute', left: -23,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--cheese-green)',
                  border: '3px solid var(--bg-app)',
                  boxShadow: '0 0 10px var(--cheese-green)',
                }} />
                <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 13.5,
                  letterSpacing: '0.06em', color: 'var(--text-high)', fontWeight: 700 }}>
                  {date}
                </span>
                <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12,
                  color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  · {list.length}경기
                </span>
              </div>

              {/* 매치 카드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {list.map((m, i) => {
                  const isOpen = openId === m.id;
                  return (
                    <div key={m.id} style={{
                      overflow: 'hidden', borderRadius: 'var(--r-lg)',
                      background: 'var(--surface-card)',
                      border: `1px solid ${isOpen ? 'var(--border-glow)' : 'var(--border-line)'}`,
                      boxShadow: isOpen ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
                      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
                    }}>
                      <MatchRow
                        match={m}
                        open={isOpen}
                        idx={matches.length - matches.indexOf(m)}
                        onClick={() => setOpenId(isOpen ? null : m.id)}
                        onDelete={() => handleDelete(m.id)}
                      />
                      {isOpen && <MatchDetail match={m} getName={getName} getGameName={getGameName} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
