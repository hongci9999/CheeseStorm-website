'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { getCuratedTierLists, getStreamers, getMatches, saveCuratedTierLists } from '@/lib/firestore';
import {
  buildCuratedPlayers,
  emptyTierLists,
  groupCuratedByTier,
  moveStreamer,
  sanitizeLists,
  type CuratedPlayer,
} from '@/lib/curated-tier';
import { HexAvatar, HEX_CLIP, TIER_COLOR_VAR } from '@/components/hexagon-avatar';
import type { CuratedTierLists, FineRole, Match, Streamer, Tier } from '@/lib/types';

const ROLES: FineRole[] = ['탱커', '투사', '원거리 암살자', '근접 암살자', '지원가', '전문가'];
const DRAG_TYPE = 'text/streamer-id';
const POOL_WIDTH = 260;

// ── TierBadge (자동 탭과 동일 스타일) ───────────────────────────
function TierBadge({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 28, md: 40, lg: 56, xl: 84 }[size] ?? 40;
  const fs   = { sm: 14, md: 20, lg: 28, xl: 44 }[size] ?? 20;
  const color = `var(${TIER_COLOR_VAR[tier]})`;
  const label = tier === 'unranked' ? '?' : tier;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: dims, height: dims,
      alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        position: 'absolute', inset: 0,
        background: color, clipPath: HEX_CLIP,
        filter: `drop-shadow(0 0 10px ${color})`,
      }} />
      <span style={{
        position: 'relative', fontFamily: 'var(--font-display)', fontWeight: 900,
        fontSize: fs, lineHeight: 1, color: 'var(--ink-1000)', paddingBottom: 2,
      }}>
        {label}
      </span>
    </span>
  );
}

// ── 역할 필터 ─────────────────────────────────────────────────
function FilterBar({ role, onRole }: { role: string; onRole: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {['전체', ...ROLES].map(r => (
        <button
          key={r}
          onClick={() => onRole(r)}
          style={{
            height: 32, padding: '0 12px', borderRadius: 'var(--r-pill)',
            border: `1px solid ${role === r ? 'var(--cheese-green)' : 'var(--border-line)'}`,
            background: role === r ? 'color-mix(in srgb, var(--cheese-green) 15%, transparent)' : 'transparent',
            color: role === r ? 'var(--cheese-green)' : 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ── 플레이어 셀 (편집 모드에서 드래그 가능) ─────────────────────
function CuratedPlayerCell({
  p, tier, editMode, dragging, dragOver, compact,
  onDragStart, onDragEnd, onDragEnterCell, onDropBefore,
}: {
  p: CuratedPlayer;
  tier: Tier;
  editMode: boolean;
  dragging: boolean;
  dragOver?: boolean;
  compact?: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragEnterCell?: () => void;
  onDropBefore?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = `var(${TIER_COLOR_VAR[tier]})`;
  const size = compact ? 44 : 54;

  const body = (
    <>
      <HexAvatar
        name={p.streamerName}
        imageUrl={p.profileImageUrl}
        ring={color}
        ringWidth={tier !== 'unranked' ? 2 : 1.5}
        size={size}
      />
      <span style={{
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: compact ? 11.5 : 12.5,
        color: 'var(--text-high)', maxWidth: compact ? 68 : 74,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {p.streamerName}
      </span>
    </>
  );

  const sharedStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 4 : 6,
    width: compact ? 72 : 78, padding: compact ? '6px 2px' : 'var(--sp-3) 4px',
    borderRadius: 'var(--r-md)',
    background: dragOver
      ? 'color-mix(in srgb, var(--cheese-green) 18%, var(--surface-raise))'
      : hover ? 'var(--surface-raise)' : 'transparent',
    transform: hover && !editMode ? 'translateY(-2px)' : 'none',
    transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), opacity var(--dur-fast)',
    opacity: dragging ? 0.45 : 1,
    cursor: editMode ? 'grab' : 'pointer',
  };

  if (editMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, p.streamerId);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(p.streamerId);
        }}
        onDragEnd={onDragEnd}
        onDragOver={onDropBefore ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
        onDragEnter={onDropBefore ? (e) => { e.preventDefault(); e.stopPropagation(); onDragEnterCell?.(); } : undefined}
        onDrop={onDropBefore ? (e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(); } : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={sharedStyle}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/streamers/${p.streamerId}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...sharedStyle, textDecoration: 'none' }}
    >
      {body}
    </Link>
  );
}

// ── 티어 행 (드롭 존) ─────────────────────────────────────────
function CuratedTierRow({
  tier, players, editMode, dragOver, draggingId, dragOverCellId,
  onDragEnter, onDragLeave, onDropAppend,
  onDragStart, onDragEnd, onCellDragEnter, onDropBefore,
}: {
  tier: Tier;
  players: CuratedPlayer[];
  editMode: boolean;
  dragOver: boolean;
  draggingId: string | null;
  dragOverCellId: string | null;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDropAppend: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onCellDragEnter: (id: string) => void;
  onDropBefore: (beforeId: string) => void;
}) {
  const isS = tier === 'S';
  const color = `var(${TIER_COLOR_VAR[tier]})`;

  return (
    <div
      onDragOver={editMode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
      onDragEnter={editMode ? (e) => { e.preventDefault(); onDragEnter(); } : undefined}
      onDragLeave={editMode ? onDragLeave : undefined}
      onDrop={editMode ? (e) => { e.preventDefault(); onDropAppend(); } : undefined}
      style={{
        position: 'relative', display: 'flex', alignItems: 'stretch', overflow: 'hidden',
        borderRadius: 'var(--r-lg)', background: 'var(--surface-card)',
        border: `1px solid ${dragOver ? 'var(--cheese-green)' : isS ? 'var(--border-glow)' : 'var(--border-line)'}`,
        boxShadow: dragOver
          ? '0 0 0 2px color-mix(in srgb, var(--cheese-green) 25%, transparent)'
          : isS ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}
    >
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: color, boxShadow: `0 0 14px ${color}`,
      }} />
      <div style={{
        width: 148, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: 'var(--sp-3) var(--sp-4)',
        borderRight: '1px solid var(--border-faint)',
        background: isS ? 'var(--grad-sweep)' : 'transparent',
      }}>
        <TierBadge tier={tier} size="lg" />
        {tier === 'unranked' && (
          <span style={{
            fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.1em',
            color: 'var(--text-faint)', textAlign: 'center',
          }}>
            미배정
          </span>
        )}
      </div>
      <div style={{
        flex: 1, display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)',
        alignContent: 'center', padding: 'var(--sp-2) var(--sp-4)',
        minHeight: 88,
      }}>
        {players.length === 0 && editMode && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-faint)',
            padding: 'var(--sp-3)',
          }}>
            여기로 드래그
          </span>
        )}
        {players.map((p) => (
          <CuratedPlayerCell
            key={p.streamerId}
            p={p}
            tier={tier}
            editMode={editMode}
            dragging={draggingId === p.streamerId}
            dragOver={editMode && dragOverCellId === p.streamerId && draggingId !== p.streamerId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragEnterCell={editMode ? () => onCellDragEnter(p.streamerId) : undefined}
            onDropBefore={editMode ? () => onDropBefore(p.streamerId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── 오른쪽 스트리머 패널 (등록된 전원 — 여기서 끌어다 씀) ───────
function RosterPanel({
  players, editMode, dragOver, draggingId,
  onDragEnter, onDragLeave, onDrop, onDragStart, onDragEnd,
}: {
  players: CuratedPlayer[];
  editMode: boolean;
  dragOver: boolean;
  draggingId: string | null;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <aside
      onDragOver={editMode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
      onDragEnter={editMode ? (e) => { e.preventDefault(); onDragEnter(); } : undefined}
      onDragLeave={editMode ? onDragLeave : undefined}
      onDrop={editMode ? (e) => { e.preventDefault(); onDrop(); } : undefined}
      style={{
        width: POOL_WIDTH,
        flexShrink: 0,
        position: 'sticky',
        top: 88,
        alignSelf: 'flex-start',
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-card)',
        border: `1px solid ${dragOver ? 'var(--cheese-green)' : 'var(--border-line)'}`,
        boxShadow: dragOver
          ? '0 0 0 2px color-mix(in srgb, var(--cheese-green) 20%, transparent)'
          : 'var(--shadow-sm)',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        padding: 'var(--sp-4) var(--sp-4) var(--sp-3)',
        borderBottom: '1px solid var(--border-faint)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          color: 'var(--text-strong)',
        }}>
          미배정 스트리머
        </div>
        <div style={{
          marginTop: 4, fontFamily: 'var(--font-ui)', fontSize: 12,
          color: 'var(--text-muted)', lineHeight: 1.45,
        }}>
          등록된 스트리머 {players.length}명 · 왼쪽 티어로 드래그
        </div>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', padding: 'var(--sp-3)',
        display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1)',
        alignContent: 'flex-start', justifyContent: 'center',
      }}>
        {players.length === 0 ? (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-faint)',
            padding: 'var(--sp-4)', textAlign: 'center', lineHeight: 1.5,
          }}>
            등록된 스트리머가 없습니다.
            <br />
            <Link href="/streamers" style={{ color: 'var(--cheese-green)', fontWeight: 600 }}>
              스트리머 페이지
            </Link>
            에서 추가하세요.
          </span>
        ) : (
          players.map((p) => (
            <CuratedPlayerCell
              key={p.streamerId}
              p={p}
              tier={p.tier}
              editMode={editMode}
              compact
              dragging={draggingId === p.streamerId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </aside>
  );
}

// ── 스트리머 티어표 안내 ───────────────────────────────────────
function CurationTierNotice() {
  return (
    <div style={{
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in srgb, var(--cheese-green) 40%, var(--border-line))',
      background: 'color-mix(in srgb, var(--cheese-green) 10%, var(--surface-card))',
      padding: 'var(--sp-3) var(--sp-4)',
      marginBottom: 'var(--sp-5)',
    }}>
      <p style={{
        margin: 0, fontSize: 13, fontFamily: 'var(--font-ui)',
        color: 'var(--cheese-green)', fontWeight: 600, lineHeight: 1.55,
      }}>
        사이트에 등록된 스트리머가 수정하는 티어표 입니다. 모든 이용자가 하나의 티어표를 공유합니다.
      </p>
    </div>
  );
}

// ── 스트리머 티어표 탭 ─────────────────────────────────────────
export function CurationTierTab({
  streamers: streamersProp,
  matches: matchesProp,
}: {
  streamers: Streamer[];
  matches: Match[];
}) {
  const { isStreamer } = useAuth();
  const [roster, setRoster] = useState<Streamer[]>(streamersProp);
  const [matchList, setMatchList] = useState<Match[]>(matchesProp);
  const [lists, setLists] = useState<CuratedTierLists>(emptyTierLists());
  const [role, setRole] = useState('전체');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<Tier | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, m] = await Promise.all([
          getStreamers({ fresh: true }),
          getMatches(),
        ]);
        const raw = await getCuratedTierLists(s.map((x) => x.id));
        if (cancelled) return;
        setRoster(s);
        setMatchList(m);
        setLists(sanitizeLists(raw, s.map((x) => x.id)));
      } catch {
        if (!cancelled) setError('스트리머 티어표를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 부모에서 데이터가 먼저 도착하면 동기화
  useEffect(() => {
    if (streamersProp.length > 0) setRoster(streamersProp);
  }, [streamersProp]);
  useEffect(() => {
    if (matchesProp.length > 0) setMatchList(matchesProp);
  }, [matchesProp]);

  // 편집 모드 진입 시 최신 스트리머 목록 갱신
  useEffect(() => {
    if (!editMode) return;
    let cancelled = false;
    getStreamers({ fresh: true }).then((s) => {
      if (!cancelled) setRoster(s);
    });
    return () => { cancelled = true; };
  }, [editMode]);

  const persist = useCallback(async (next: CuratedTierLists) => {
    setSaving(true);
    setError('');
    try {
      await saveCuratedTierLists(next);
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleDrop = useCallback((tier: Tier, insertBeforeId?: string) => {
    if (!draggingId) return;
    const next = moveStreamer(lists, draggingId, tier, insertBeforeId);
    setLists(next);
    setDraggingId(null);
    setDragOverTier(null);
    setDragOverCellId(null);
    void persist(next);
  }, [draggingId, lists, persist]);

  const players = useMemo(
    () => buildCuratedPlayers(roster, lists, matchList),
    [roster, lists, matchList],
  );

  const filtered = useMemo(
    () => players.filter((p) => role === '전체' || p.fineRole === role),
    [players, role],
  );

  const groups = useMemo(
    () => groupCuratedByTier(filtered, {
      showEmptyTiers: editMode,
      includeUnranked: !editMode,
    }),
    [filtered, editMode],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
        스트리머 티어표 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: editMode ? 'var(--sp-5)' : 0,
      alignItems: 'flex-start',
    }}>
      {/* 티어표 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <CurationTierNotice />
        {/* 툴바: 역할 필터 + 오른쪽 위 티어 편집 */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)', flexWrap: 'wrap',
        }}>
          <FilterBar role={role} onRole={setRole} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {isStreamer && <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                height: 36, padding: '0 16px', borderRadius: 'var(--r-sm)',
                border: `1px solid ${editMode ? 'var(--cheese-green)' : 'var(--border-line)'}`,
                background: editMode
                  ? 'color-mix(in srgb, var(--cheese-green) 18%, transparent)'
                  : 'var(--surface-raise)',
                color: editMode ? 'var(--cheese-green)' : 'var(--text-high)',
                fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {editMode ? '편집 완료' : '티어 편집'}
            </button>}
            {saving && (
              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12, color: 'var(--text-faint)' }}>
                저장 중...
              </span>
            )}
            {error && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--loss)' }}>
                {error}
              </span>
            )}
          </div>
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 60 }}>
            표시할 스트리머가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {groups.map(({ tier, players: rowPlayers }) => (
              <CuratedTierRow
                key={tier}
                tier={tier}
                players={rowPlayers}
                editMode={editMode}
                dragOver={dragOverTier === tier && !dragOverCellId}
                draggingId={draggingId}
                dragOverCellId={dragOverCellId}
                onDragEnter={() => setDragOverTier(tier)}
                onDragLeave={() => setDragOverTier((t) => (t === tier ? null : t))}
                onDropAppend={() => handleDrop(tier)}
                onDropBefore={(beforeId) => handleDrop(tier, beforeId)}
                onCellDragEnter={setDragOverCellId}
                onDragStart={setDraggingId}
                onDragEnd={() => { setDraggingId(null); setDragOverTier(null); setDragOverCellId(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽 미배정 패널 — 편집 모드에서만 */}
      {editMode && (
        <RosterPanel
          players={filtered}
          editMode={editMode}
          dragOver={dragOverTier === 'unranked'}
          draggingId={draggingId}
          onDragEnter={() => setDragOverTier('unranked')}
          onDragLeave={() => setDragOverTier((t) => (t === 'unranked' ? null : t))}
          onDrop={() => handleDrop('unranked')}
          onDragStart={setDraggingId}
          onDragEnd={() => { setDraggingId(null); setDragOverTier(null); setDragOverCellId(null); }}
        />
      )}
    </div>
  );
}
