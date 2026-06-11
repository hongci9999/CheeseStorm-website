'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, getMatches, addStreamer, deleteStreamer, isFirebaseConfigured } from '@/lib/firestore';
import { validateStreamerForm, parseChzzkId } from '@/lib/streamer';
import { calcPlayerStats } from '@/lib/tier';
import type { Streamer, PlayerStats, Tier } from '@/lib/types';
import { MOCK_STREAMERS, MOCK_MATCHES } from '@/test/fixtures';
import { HexAvatar, TIER_COLOR_VAR } from '@/components/hexagon-avatar';

const INPUT: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px',
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
  background: 'var(--surface-input)', color: 'var(--text-high)',
  fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontFamily: 'var(--font-numeral)', letterSpacing: '0.08em',
  color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6, display: 'block',
};

// ── 스트리머 카드 ─────────────────────────────────────────────
// 티어리스트와 동일한 육각형 컴포넌트 사용. 사진 없으면 닉네임 이니셜 폴백.
// 하단 그라데이션 위에 닉네임 + 계정레벨(주요 정보) 기입.
const CARD_HEX = 200;

type BorderMode = 'tier' | 'purple';

function StreamerCard({
  streamer, tier = 'unranked', borderMode = 'tier', onOpen, onDelete,
}: {
  streamer: Streamer;
  tier?: Tier;            // 내전 기록 기반 티어 — 테두리 색
  borderMode?: BorderMode; // A) 티어색  B) 히오스 보라 통일
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  // A) 티어리스트와 동일하게 티어 색(unranked 회색)  B) 전부 히오스 보라로 통일
  const ring = borderMode === 'purple' ? 'var(--hots-purple)' : `var(${TIER_COLOR_VAR[tier]})`;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', cursor: 'pointer',
        display: 'flex', justifyContent: 'center',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out)',
        filter: hover ? `drop-shadow(0 0 12px color-mix(in srgb, ${ring} 45%, transparent))` : 'none',
      }}
    >
      {/* 삭제 — hover 시만 */}
      {hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label="삭제"
          style={{
            position: 'absolute', top: 4, right: '50%', marginRight: -CARD_HEX / 2 + 4, zIndex: 2,
            background: 'color-mix(in srgb, var(--bg-void) 55%, transparent)',
            border: 'none', cursor: 'pointer',
            width: 22, height: 22, borderRadius: '50%',
            color: 'var(--text-faint)', fontSize: 12, lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
        >
          ✕
        </button>
      )}

      {/* 육각형 프로필 — 사진 or 이니셜 + 하단 그라데이션 오버레이 */}
      <HexAvatar
        name={streamer.name}
        imageUrl={streamer.profileImageUrl}
        ring={ring}
        ringWidth={6}
        size={CARD_HEX}
      >
        {/* 하단 그라데이션 + 닉네임 + 계정레벨 */}
        <span style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          gap: 2, paddingBottom: CARD_HEX * 0.11, pointerEvents: 'none',
          background: 'linear-gradient(to top, color-mix(in srgb, var(--bg-void) 92%, transparent) 28%, transparent)',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
            color: 'var(--text-strong)', maxWidth: '78%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,.6)',
          }}>
            {streamer.name}
          </span>
          {streamer.accountLevel != null && (
            <span style={{
              fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 12.5,
              letterSpacing: '0.04em', color: 'var(--cheese-green)',
              textShadow: '0 1px 4px rgba(0,0,0,.6)',
            }}>
              Lv {streamer.accountLevel}
            </span>
          )}
        </span>
      </HexAvatar>
    </div>
  );
}

// ── 벌집 배열 ─────────────────────────────────────────────────
// 한 줄당 5개 고정, 좌→우 채움. 홀수 행은 반 칸 오른쪽으로 밀고(brick),
// 행끼리 세로로 겹쳐 육각형이 골 사이에 맞물리게. 블록 전체는 가운데 정렬.
//
// 정육각형(pointy-top): 폭 = 0.866·높이. 박스(CARD_HEX)는 정사각이라
// 육각형이 좌우로 박스보다 좁다 → 박스를 겹쳐(음수 margin) 보정.
// GAP(육각형 가장자리 간격)을 상하·좌우 동일하게 맞추는 기하:
//   가로 중심간격 STEP_X = 0.866·H + GAP
//   세로 행간격   ROW_MT = -0.25·H + 0.866·GAP   (브릭 반칸 오프셋 기준)
const ROW_FULL = 5;                                       // 한 줄당 카드 수
const GAP = 20;                                           // 육각형 가장자리 간격 (상하=좌우)
const STEP_X = Math.round(CARD_HEX * 0.866 + GAP);        // 가로 칸 간격(중심간격)
const STEP_MARGIN = STEP_X - CARD_HEX;                    // 박스 폭과 차이(음수) → marginLeft
const ROW_MT = Math.round(-CARD_HEX * 0.25 + GAP * 0.866); // 세로 맞물림

function Honeycomb({ children }: { children: ReactElement[] }) {
  const rows: ReactElement[][] = [];
  for (let i = 0; i < children.length; i += ROW_FULL)
    rows.push(children.slice(i, i + ROW_FULL));

  // 5칸 한 줄 폭 + 홀수 행 반 칸 오프셋까지 감싸 margin auto 로 가운데
  const blockWidth = CARD_HEX + (ROW_FULL - 1) * STEP_X + STEP_X / 2;

  return (
    <div style={{ width: blockWidth, maxWidth: '100%', margin: '0 auto' }}>
      {rows.map((row, r) => (
        <div key={r} style={{
          display: 'flex',
          marginTop: r === 0 ? 0 : ROW_MT,
          marginLeft: r % 2 === 1 ? STEP_X / 2 : 0,  // 홀수 행 반 칸 오프셋
        }}>
          {row.map((child, c) => (
            <div key={child.key} style={{
              width: CARD_HEX, flexShrink: 0,
              marginLeft: c === 0 ? 0 : STEP_MARGIN,  // 박스 겹쳐 가로 간격 = GAP
            }}>
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 추가 모달 ─────────────────────────────────────────────────
function AddModal({
  onClose, onAdded,
}: {
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [name,       setName]       = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [level,      setLevel]      = useState('');
  const [battleTag,  setBattleTag]  = useState('');
  const [adding,     setAdding]     = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateStreamerForm(name, level);
    if (!v.valid) { setError(v.error); return; }
    setAdding(true); setError('');
    try {
      // Firestore는 undefined 필드 거부 → 값 있는 것만 담는다
      const data: Parameters<typeof addStreamer>[0] = { name: name.trim() };
      const chzzkId = parseChzzkId(channelUrl);
      if (chzzkId) data.chzzkId = chzzkId;
      if (level.trim()) data.accountLevel = Number(level);
      if (battleTag.trim()) data.gameNames = [battleTag.trim()];
      await addStreamer(data);
      await onAdded();
      onClose();
    } catch {
      setError('추가 중 오류가 발생했습니다.');
      setAdding(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'color-mix(in srgb, var(--bg-void) 65%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sp-4)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-6)',
          display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
          boxShadow: 'var(--shadow-lg, 0 12px 40px rgba(0,0,0,.4))',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
          color: 'var(--text-strong)' }}>
          새 스트리머 추가
        </span>

        <div>
          <label style={LABEL}>이름 *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="닉네임" required autoFocus style={INPUT} />
        </div>

        <div>
          <label style={LABEL}>채널주소 (선택)</label>
          <input value={channelUrl} onChange={e => setChannelUrl(e.target.value)}
            placeholder="https://chzzk.naver.com/..." style={INPUT} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <div>
            <label style={LABEL}>계정레벨 (선택)</label>
            <input value={level} onChange={e => setLevel(e.target.value)}
              placeholder="523" inputMode="numeric" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>배틀태그 (선택)</label>
            <input value={battleTag} onChange={e => setBattleTag(e.target.value)}
              placeholder="Cheese#3142" style={INPUT} />
          </div>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)',
          margin: 0, lineHeight: 1.5 }}>
          포지션은 입력하지 않습니다 — 내전 기록의 플레이 영웅에 따라 자동 결정됩니다.
        </p>

        {error && (
          <p style={{ fontSize: 12.5, color: 'var(--loss)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-3)' }}>
          <button type="button" onClick={onClose} style={{
            height: 44, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
            background: 'transparent', color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>취소</button>
          <button type="submit" disabled={adding || !name.trim()} style={{
            height: 44, borderRadius: 'var(--r-sm)', border: 'none',
            background: adding || !name.trim() ? 'var(--ink-700)' : 'var(--cheese-green)',
            color: adding || !name.trim() ? 'var(--text-faint)' : 'var(--text-on-green)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            cursor: adding || !name.trim() ? 'not-allowed' : 'pointer',
          }}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────
export default function StreamersPage() {
  const router = useRouter();
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [statsMap,  setStatsMap]  = useState<Map<string, PlayerStats>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);
  const [borderMode, setBorderMode] = useState<BorderMode>('tier');

  async function load() {
    const [list, matches] = isFirebaseConfigured
      ? await Promise.all([getStreamers(), getMatches()])
      : [MOCK_STREAMERS, MOCK_MATCHES];
    setStreamers(list);
    setStatsMap(new Map(calcPlayerStats(list, matches).map(p => [p.streamerId, p])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(s: Streamer) {
    if (!confirm(`"${s.name}"을(를) 삭제하시겠습니까?`)) return;
    await deleteStreamer(s.id);
    setStreamers(prev => prev.filter(x => x.id !== s.id));
  }

  const filtered = streamers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* 헤더 */}
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-3xl)',
          color: 'var(--text-strong)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0 }}>
          스트리머
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          ROSTER · {streamers.length}명 등록됨
        </p>
      </div>

      {/* 검색 + 테두리 모드 토글 — 상단 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        <div style={{ position: 'relative', width: 260 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="스트리머 검색"
            style={{ ...INPUT, paddingLeft: 36 }}
          />
        </div>

        {/* 테두리: A) 티어색  B) 히오스 보라 */}
        <div style={{ display: 'inline-flex', padding: 3, borderRadius: 'var(--r-pill)',
          background: 'var(--surface-input)', border: '1px solid var(--border-line)' }}>
          {([['tier', '티어색'], ['purple', '히오스 보라']] as [BorderMode, string][]).map(([mode, label]) => {
            const on = borderMode === mode;
            const accent = mode === 'purple' ? 'var(--hots-purple)' : 'var(--cheese-green)';
            return (
              <button key={mode} onClick={() => setBorderMode(mode)}
                style={{
                  height: 30, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
                  background: on ? `color-mix(in srgb, ${accent} 18%, transparent)` : 'transparent',
                  color: on ? accent : 'var(--text-muted)',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 카드 그리드 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 'var(--sp-8)' }}>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 'var(--sp-8)',
          fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          {search ? '검색 결과가 없습니다.' : '등록된 스트리머가 없습니다.'}
        </div>
      ) : (
        <Honeycomb>
          {filtered.map(s => (
            <StreamerCard
              key={s.id}
              streamer={s}
              tier={statsMap.get(s.id)?.tier}
              borderMode={borderMode}
              onOpen={() => router.push(`/streamers/${s.id}`)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </Honeycomb>
      )}

      {/* FAB — 하단 우측 */}
      <button
        onClick={() => setShowModal(true)}
        aria-label="스트리머 추가"
        style={{
          position: 'fixed', right: 28, bottom: 28, zIndex: 40,
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: 'var(--cheese-green)', color: 'var(--text-on-green)',
          fontSize: 26, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
          boxShadow: 'var(--glow-green-soft), 0 6px 20px rgba(0,0,0,.35)',
          transition: 'transform var(--dur-fast) var(--ease-out)',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
      >
        ＋
      </button>

      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdded={load} />
      )}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
