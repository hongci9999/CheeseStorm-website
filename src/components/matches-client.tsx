'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteMatch } from '@/lib/api-client';
import { participants, displaySides } from '@/lib/match';
import type { Match, Streamer } from '@/lib/types';
import { HeroTeamStack, MatchDetail } from '@/components/match-detail';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type { Bp } from '@/hooks/use-breakpoint';

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

// ── MatchFilters ──────────────────────────────────────────────
function MatchFilters({
  search, onSearch, isStreamer, bp,
}: {
  search: string; onSearch: (v: string) => void; isStreamer: boolean; bp: Bp;
}) {
  const isMobile = bp === 'mobile';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: isMobile ? '100%' : 260 }}>
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

      {isStreamer && !isMobile && (
        <Link href="/matches/new" style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 40, padding: '0 var(--sp-4)',
          borderRadius: 'var(--r-sm)', background: 'var(--cheese-green)',
          color: 'var(--text-on-green)', fontFamily: 'var(--font-ui)',
          fontWeight: 700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap',
          transition: `background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
        }}>
          ＋ 경기 입력
        </Link>
      )}
    </div>
  );
}

// ── LevelChip ─────────────────────────────────────────────────
function LevelChip({ level, won }: { level: number; won: boolean }) {
  return (
    <span title="최종 레벨" style={{
      display: 'inline-flex', alignItems: 'baseline', flexShrink: 0,
      color: won ? 'var(--win)' : 'var(--text-muted)',
      fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 24, lineHeight: 1,
    }}>
      <span style={{ fontSize: 11, opacity: 0.7, marginRight: 2 }}>Lv</span>{level}
    </span>
  );
}

// ── MatchRow ──────────────────────────────────────────────────
function MatchRow({
  match, open, idx, onClick, onDelete, onEdit, canEdit, bp,
}: {
  match: Match; open: boolean; idx: number;
  onClick: () => void; onDelete: () => void; onEdit: () => void;
  canEdit: boolean; bp: Bp;
}) {
  const isMobile = bp === 'mobile';
  const heroSize = isMobile ? 20 : 24;
  const { left, right } = displaySides(match);
  const leftHeroes = left.roster.map(([, h]) => h);
  const rightHeroes = right.roster.map(([, h]) => h);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minHeight: 68,
      padding: '0 var(--sp-4)', cursor: 'pointer',
      background: open ? 'var(--grad-sweep)' : 'transparent',
      transition: 'background var(--dur-fast) var(--ease-out)',
    }} onClick={onClick}>
      {!isMobile && (
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5, color: 'var(--text-faint)',
          width: 32, letterSpacing: '0.04em', flexShrink: 0 }}>
          #{idx}
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <HeroTeamStack heroes={leftHeroes} won={left.won} glow size={heroSize} />
        {left.level != null && <LevelChip level={left.level} won={left.won} />}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
          color: 'var(--text-faint)', letterSpacing: '0.06em' }}>VS</span>
        {right.level != null && <LevelChip level={right.level} won={right.won} />}
        <HeroTeamStack heroes={rightHeroes} won={right.won} glow size={heroSize} />
      </div>

      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
        color: 'var(--text-high)', flex: 1, marginLeft: 'var(--sp-2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {match.map ?? '—'}
      </span>

      {match.dur && (
        <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 16, fontWeight: 800,
          color: 'var(--text-high)', letterSpacing: '0.02em',
          whiteSpace: 'nowrap', flexShrink: 0 }}>
          {match.dur}
        </span>
      )}

      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5,
        color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {relativeDate(match.date)}
      </span>

      {canEdit && !isMobile && <>
        <button type="button" onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
            borderRadius: 'var(--r-xs)', color: 'var(--text-faint)', fontSize: 11, flexShrink: 0,
            transition: 'color var(--dur-fast) var(--ease-out)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--cheese-green)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          title="경기 수정">✎</button>
        <button type="button" onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
            borderRadius: 'var(--r-xs)', color: 'var(--text-faint)', fontSize: 11, flexShrink: 0,
            transition: 'color var(--dur-fast) var(--ease-out)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          title="경기 삭제">✕</button>
      </>}

      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0,
        transition: `transform var(--dur-fast) var(--ease-out)`,
        transform: open ? 'rotate(180deg)' : 'none',
      }}>▾</span>
    </div>
  );
}

// ── MatchesClient ─────────────────────────────────────────────
export default function MatchesClient({
  matches,
  streamers,
  isStreamer,
}: {
  matches: Match[];
  streamers: Streamer[];
  isStreamer: boolean;
}) {
  const router = useRouter();
  const bp = useBreakpoint();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const getName = (id: string) =>
    streamers.find(s => s.id === id)?.name ?? id.replace('__unknown__', '');

  async function handleDelete(id: string, idx: number) {
    if (!confirm(`#${idx} 경기를 삭제하시겠습니까?\n\n삭제된 경기는 복구할 수 없습니다.`)) return;
    await deleteMatch(id);
    if (openId === id) setOpenId(null);
    router.refresh();
  }

  const filtered = matches.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    const players = participants(m);
    const matchesPlayer = players.some(([id, hero]) =>
      getName(id).toLowerCase().includes(q) || hero.toLowerCase().includes(q)
    );
    return matchesPlayer || (m.map?.toLowerCase().includes(q) ?? false);
  });

  const sorted = [...filtered].sort(
    (a, b) => (b.date.getTime() - a.date.getTime()) || (b.createdAt.getTime() - a.createdAt.getTime()),
  );
  const groups = groupByDate(sorted);

  const numberById = new Map<string, number>();
  [...matches]
    .sort((a, b) => (a.date.getTime() - b.date.getTime()) || (a.createdAt.getTime() - b.createdAt.getTime()))
    .forEach((m, i) => numberById.set(m.id, i + 1));

  return (
    <div>
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-3xl)',
          color: 'var(--text-strong)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0 }}>
          내전기록실
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          MATCH ROOM · {matches.length}경기 기록됨
        </p>
      </div>

      <MatchFilters search={search} onSearch={setSearch} isStreamer={isStreamer} bp={bp} />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60,
          fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          {search ? '검색 결과가 없습니다.' : '아직 집계된 내전이 없습니다.'}
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 'var(--sp-6)' }}>
          <span style={{ position: 'absolute', left: 7, top: 8, bottom: 8,
            width: 2, background: 'var(--border-line)' }} />

          {groups.map(([date, list]) => (
            <div key={date} style={{ marginBottom: 'var(--sp-6)' }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {list.map((m) => {
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
                        idx={numberById.get(m.id) ?? 0}
                        onClick={() => setOpenId(isOpen ? null : m.id)}
                        onDelete={() => handleDelete(m.id, numberById.get(m.id) ?? 0)}
                        onEdit={() => router.push(`/matches/new?edit=${m.id}`)}
                        canEdit={isStreamer}
                        bp={bp}
                      />
                      {isOpen && <MatchDetail match={m} streamers={streamers} />}
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
