'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMatches, getStreamers, deleteMatch, isFirebaseConfigured } from '@/lib/firestore';
import type { Match } from '@/lib/types';
import { MOCK_MATCHES, MOCK_STREAMERS } from '@/test/fixtures';

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

// ── 소형 컴포넌트 ─────────────────────────────────────────────

function Outcome({ result }: { result: 'W' | 'L' }) {
  const win = result === 'W';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 24, borderRadius: 'var(--r-xs)',
      background: win ? 'var(--win-soft)' : 'var(--loss-soft)',
      color: win ? 'var(--win)' : 'var(--loss)',
      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
    }}>
      {win ? '승' : '패'}
    </span>
  );
}

// ── MatchFilters ──────────────────────────────────────────────
type Filter = '전체' | '블루팀 승' | '레드팀 승';
const FILTERS: Filter[] = ['전체', '블루팀 승', '레드팀 승'];

function MatchFilters({
  search, onSearch, filter, onFilter,
}: {
  search: string; onSearch: (v: string) => void;
  filter: Filter; onFilter: (v: Filter) => void;
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

      {/* 필터 태그 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => onFilter(f)} style={{
            height: 32, padding: '0 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            border: `1px solid ${filter === f ? 'var(--cheese-green)' : 'var(--border-line)'}`,
            background: filter === f ? 'color-mix(in srgb, var(--cheese-green) 12%, transparent)' : 'transparent',
            color: filter === f ? 'var(--cheese-green)' : 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
            transition: 'all var(--dur-fast) var(--ease-out)',
          }}>
            {f}
          </button>
        ))}
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

// ── TeamColumn ────────────────────────────────────────────────
function TeamColumn({
  side, roster, won, getName,
}: {
  side: 'blue' | 'red'; roster: [string, string][]; won: boolean; getName: (id: string) => string;
}) {
  const isBlue  = side === 'blue';
  const accent  = isBlue ? 'var(--cheese-blue)' : 'var(--loss)';
  const label   = isBlue ? '블루팀' : '레드팀';

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* 팀 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: accent,
            boxShadow: `0 0 8px ${accent}`, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            color: 'var(--text-high)' }}>{label}</span>
        </div>
        {won ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
            borderRadius: 'var(--r-xs)',
            background: isBlue ? 'rgba(128,208,240,0.15)' : 'rgba(255,92,108,0.15)',
            border: `1px solid ${isBlue ? 'rgba(128,208,240,0.4)' : 'rgba(255,92,108,0.4)'}`,
            color: accent, fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.08em',
          }}>승리</span>
        ) : (
          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12, letterSpacing: '0.08em',
            color: 'var(--text-faint)' }}>패배</span>
        )}
      </div>

      {/* 플레이어 행 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {roster.map(([id, hero]) => (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 12px',
            borderRadius: 'var(--r-sm)', background: 'var(--surface-card)',
            borderLeft: `3px solid ${won ? accent : 'var(--ink-700)'}`,
          }}>
            {/* 이니셜 아바타 */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 'var(--r-sm)',
              background: 'var(--surface-raise)', flexShrink: 0,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
              color: 'var(--text-muted)',
            }}>
              {getName(id).slice(0, 2)}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5,
              color: 'var(--text-high)', flex: 1, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getName(id)}
            </span>
            {hero && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13,
                color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {hero}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MatchDetail ───────────────────────────────────────────────
function MatchDetail({ match, getName }: { match: Match; getName: (id: string) => string }) {
  return (
    <div style={{ padding: 'var(--sp-4) var(--sp-5) var(--sp-5)',
      borderTop: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'flex-start' }}>
        <TeamColumn side="blue" roster={match.blueTeam} won={match.winner === 'blue'} getName={getName} />
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', paddingTop: 44 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
            color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
        </div>
        <TeamColumn side="red" roster={match.redTeam} won={match.winner === 'red'} getName={getName} />
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
  match, open, idx, getName, onClick, onDelete,
}: {
  match: Match; open: boolean; idx: number;
  getName: (id: string) => string;
  onClick: () => void;
  onDelete: () => void;
}) {
  const blueWon = match.winner === 'blue';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', height: 60,
      padding: '0 var(--sp-4)', cursor: 'pointer',
      background: open ? 'var(--grad-sweep)' : 'transparent',
      transition: 'background var(--dur-fast) var(--ease-out)',
    }}
      onClick={onClick}
    >
      {/* 일련번호 */}
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5, color: 'var(--text-faint)',
        width: 40, letterSpacing: '0.04em', flexShrink: 0 }}>
        #{idx}
      </span>

      {/* 승패 캡슐 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        borderRadius: 'var(--r-pill)', background: 'var(--surface-card)',
        border: '1px solid var(--border-line)', flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cheese-blue)',
            display: 'inline-block' }} />
          <Outcome result={blueWon ? 'W' : 'L'} />
        </span>
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11, color: 'var(--text-faint)' }}>vs</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Outcome result={blueWon ? 'L' : 'W'} />
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--loss)',
            display: 'inline-block' }} />
        </span>
      </div>

      {/* 맵 */}
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
        color: 'var(--text-high)', flex: 1, marginLeft: 4,
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
  const [loading,   setLoading]   = useState(true);
  const [openId,    setOpenId]    = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState<Filter>('전체');

  useEffect(() => {
    async function load() {
      if (!isFirebaseConfigured) {
        setMatches(MOCK_MATCHES);
        setNameMap(new Map(MOCK_STREAMERS.map(s => [s.id, s.name])));
        setLoading(false);
        return;
      }
      const [ml, sl] = await Promise.all([getMatches(), getStreamers()]);
      setMatches(ml);
      setNameMap(new Map(sl.map(s => [s.id, s.name])));
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

  // 필터 + 검색
  const filtered = matches.filter(m => {
    if (filter === '블루팀 승' && m.winner !== 'blue') return false;
    if (filter === '레드팀 승' && m.winner !== 'red') return false;
    if (search) {
      const q = search.toLowerCase();
      const players = [...m.blueTeam, ...m.redTeam];
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
        filter={filter} onFilter={setFilter}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60,
          fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          {search || filter !== '전체' ? '검색 결과가 없습니다.' : '아직 집계된 내전이 없습니다.'}
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
                        getName={getName}
                        onClick={() => setOpenId(isOpen ? null : m.id)}
                        onDelete={() => handleDelete(m.id)}
                      />
                      {isOpen && <MatchDetail match={m} getName={getName} />}
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
