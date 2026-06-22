'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, getCachedStreamers, isFirebaseConfigured } from '@/lib/firestore';
import { addStreamer, deleteStreamer, updateStreamerGameNames, updateStreamerInfo, updateStreamerProfileImage } from '@/lib/api-client';
import { validateStreamerForm, parseChzzkId, sortStreamersByName } from '@/lib/streamer';
import { fetchChzzkProfiles, isProfileStale } from '@/lib/chzzk-profile';
import type { Streamer } from '@/lib/types';
import { HexAvatar } from '@/components/hexagon-avatar';
import { LevelBadge } from '@/components/level-badge';
import { ProSticker } from '@/components/pro-sticker';
import { isProStreamer } from '@/lib/pro-streamers';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/use-breakpoint';

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
function StreamerCard({
  streamer, onOpen, onDelete, onEditGameNames, canEdit, canDelete, cardHex, nameFontSize,
}: {
  streamer: Streamer;
  onOpen: () => void;
  onDelete: () => void;
  onEditGameNames: () => void;
  canEdit: boolean;
  canDelete: boolean;
  cardHex: number;
  nameFontSize: number;
}) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [navigating, setNavigating] = useState(false);
  // 테두리 기본색 — 히오스 보라(스피너·호버 글로우 등 단색 필요처에 사용)
  const ring = 'var(--hots-purple)';
  // 테두리 스포트라이트 — 커서를 따라 빛나는 글로우. 카드 로컬 좌표(--gx/--gy) 사용.
  // background-attachment:fixed는 ancestor transform/filter(호버 확대)에 깨지므로 미사용.
  // 색은 브랜드 색역(green 160° → blue → purple 260°) 안에서만 이동해 테마와 어울림.
  // 커서에서 멀어진 부분은 hots-purple로 수렴 → 평소 테두리색 유지.
  // 기본 위치는 화면 밖(-9999px) → 커서 올리기 전/벗어난 후엔 스포트라이트 안 보이고
  // 테두리는 순수 hots-purple. 잔상 방지.
  const ringSpot = `radial-gradient(
    220px 220px at calc(var(--gx, -9999px)) calc(var(--gy, -9999px)),
    var(--cheese-green) 0%,
    var(--hots-purple) 62%
  )`;

  // 커서 위치를 카드 로컬 좌표로 환산해 CSS 변수에 기록 → 테두리 글로우가 커서 추적.
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = e.currentTarget.style;
    s.setProperty('--gx', `${x.toFixed(1)}px`);
    s.setProperty('--gy', `${y.toFixed(1)}px`);
    s.setProperty('--gxp', (x / r.width).toFixed(3));
  }

  function handleClick() {
    setNavigating(true);
    onOpen();
  }

  // 호버하면 살짝 커지고, 호버 유지되는 동안 커진 상태 유지. 벗어나면 다시 축소.
  const scale = pressed ? 'scale(0.95)' : hover ? 'scale(1.06)' : 'none';

  return (
    <div
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={e => {
        setHover(false); setPressed(false);
        // 스포트라이트 화면 밖으로 → 벗어난 방향에 글로우 잔상 남는 버그 방지
        e.currentTarget.style.setProperty('--gx', '-9999px');
        e.currentTarget.style.setProperty('--gy', '-9999px');
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative', cursor: 'pointer',
        display: 'flex', justifyContent: 'center',
        transform: scale,
        transition: pressed ? 'transform 0.08s ease' : 'transform var(--dur-fast) var(--ease-out)',
        filter: hover && !pressed ? `drop-shadow(0 0 12px color-mix(in srgb, ${ring} 45%, transparent))` : 'none',
      }}
    >
      {/* 이동 중 로딩 오버레이 */}
      {navigating && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `3px solid color-mix(in srgb, ${ring} 30%, transparent)`,
            borderTopColor: ring,
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}
      {/* 삭제 + 배틀태그 편집 — hover 시 + 권한 있을 때만 */}
      {hover && (canEdit || canDelete) && (
        <>
          {canDelete && <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            aria-label="삭제"
            style={{
              position: 'absolute', top: 4, right: '50%', marginRight: -cardHex / 2 + 4, zIndex: 2,
              background: 'color-mix(in srgb, var(--bg-void) 55%, transparent)',
              border: 'none', cursor: 'pointer',
              width: 22, height: 22, borderRadius: '50%',
              color: 'var(--text-faint)', fontSize: 12, lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            ✕
          </button>}
          {/* 배틀태그(gameNames) 편집 버튼 */}
          {canEdit && <button
            onClick={e => { e.stopPropagation(); onEditGameNames(); }}
            aria-label="배틀태그 편집"
            title="배틀태그(인게임 이름) 편집"
            style={{
              position: 'absolute', top: 4, right: '50%', marginRight: -cardHex / 2 + 30, zIndex: 2,
              background: 'color-mix(in srgb, var(--bg-void) 55%, transparent)',
              border: 'none', cursor: 'pointer',
              width: 22, height: 22, borderRadius: '50%',
              color: 'var(--text-faint)', fontSize: 11, lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--cheese-green)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            ✎
          </button>}
        </>
      )}

      {/* 육각형 프로필 — 사진 or 이니셜 + 하단 그라데이션 오버레이 */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <HexAvatar
          name={streamer.name}
          imageUrl={streamer.profileImageUrl}
          ring={ringSpot}
          ringWidth={6}
          size={cardHex}
        >
          {/* 하단 그라데이션 + 닉네임 + 계정레벨 */}
          <span style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            gap: 2, paddingBottom: cardHex * 0.11, pointerEvents: 'none',
            background: 'linear-gradient(to top, color-mix(in srgb, var(--bg-void) 92%, transparent) 28%, transparent)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: nameFontSize,
              color: 'var(--text-strong)', maxWidth: '78%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: 'var(--hex-label-shadow)',
            }}>
              {streamer.name}
            </span>
            {streamer.accountLevel != null && (
              <LevelBadge level={streamer.accountLevel} />
            )}
          </span>
        </HexAvatar>
        {isProStreamer(streamer) && <ProSticker avatarSize={cardHex} />}
      </div>
    </div>
  );
}

// ── 벌집 배열 ─────────────────────────────────────────────────
// 한 줄당 ROW_FULL개, 좌→우 채움. 홀수 행은 반 칸 오른쪽으로 밀고(brick),
// 행끼리 세로로 겹쳐 육각형이 골 사이에 맞물리게. 블록 전체는 가운데 정렬.
//
// 정육각형(pointy-top): 폭 = 0.866·높이. 박스(cardHex)는 정사각이라
// 육각형이 좌우로 박스보다 좁다 → 박스를 겹쳐(음수 margin) 보정.
// GAP(육각형 가장자리 간격)을 상하·좌우 동일하게 맞추는 기하:
//   가로 중심간격 STEP_X = 0.866·H + GAP
//   세로 행간격   ROW_MT = -0.25·H + 0.866·GAP   (브릭 반칸 오프셋 기준)
const GAP = 20; // 육각형 가장자리 간격 (상하=좌우)

function Honeycomb({ children, rowFull, cardHex }: { children: ReactElement[]; rowFull: number; cardHex: number }) {
  const stepX = Math.round(cardHex * 0.866 + GAP);       // 가로 칸 간격(중심간격)
  const stepMargin = stepX - cardHex;                     // 박스 폭과 차이(음수) → marginLeft
  const rowMt = Math.round(-cardHex * 0.25 + GAP * 0.866); // 세로 맞물림

  const rows: ReactElement[][] = [];
  for (let i = 0; i < children.length; i += rowFull)
    rows.push(children.slice(i, i + rowFull));

  // rowFull칸 한 줄 폭 + 홀수 행 반 칸 오프셋까지 감싸 margin auto 로 가운데
  const blockWidth = cardHex + (rowFull - 1) * stepX + stepX / 2;

  return (
    <div style={{ width: blockWidth, maxWidth: '100%', margin: '0 auto' }}>
      {rows.map((row, r) => (
        <div key={r} style={{
          display: 'flex',
          marginTop: r === 0 ? 0 : rowMt,
          marginLeft: r % 2 === 1 ? stepX / 2 : 0,  // 홀수 행 반 칸 오프셋
        }}>
          {row.map((child, c) => (
            <div key={child.key} style={{
              width: cardHex, flexShrink: 0,
              marginLeft: c === 0 ? 0 : stepMargin,  // 박스 겹쳐 가로 간격 = GAP
            }}>
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 배틀태그(gameNames) 편집 모달 ────────────────────────────
// 스트리머의 인게임 이름 목록을 확인·수정. 자가학습으로 추가된 별칭도 여기서 관리.
function EditGameNamesModal({
  streamer, onClose, onSaved,
}: {
  streamer: Streamer;
  onClose: () => void;
  onSaved: (updated: Streamer) => void;
}) {
  const [name,    setName]    = useState(streamer.name);
  const [level,   setLevel]   = useState(streamer.accountLevel != null ? String(streamer.accountLevel) : '');
  const [tags,    setTags]    = useState<string[]>(streamer.gameNames ?? []);
  const [input,   setInput]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  function addTag() {
    const t = input.trim();
    if (!t) return;
    if (tags.includes(t)) { setInput(''); return; }
    setTags(prev => [...prev, t]);
    setInput('');
  }

  function removeTag(i: number) {
    setTags(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('이름을 입력하세요.'); return; }
    const lvl = level.trim() === '' ? undefined : Number(level);
    if (lvl !== undefined && (!Number.isInteger(lvl) || lvl < 0)) {
      setError('레벨은 0 이상 정수여야 합니다.'); return;
    }
    setSaving(true); setError('');
    try {
      if (isFirebaseConfigured) {
        await updateStreamerInfo(streamer.id, trimmed, lvl);
        await updateStreamerGameNames(streamer.id, tags);
      }
      onSaved({ ...streamer, name: trimmed, accountLevel: lvl ?? streamer.accountLevel, gameNames: tags });
      onClose();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
      setSaving(false);
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
      <div
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
          스트리머 편집 — {streamer.name}
        </span>

        {/* 이름 · 계정 레벨 */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <div style={{ flex: 2 }}>
            <label style={LABEL}>이름</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="닉네임" style={INPUT} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>계정 레벨</label>
            <input value={level} onChange={e => setLevel(e.target.value)}
              placeholder="523" inputMode="numeric" style={INPUT} />
          </div>
        </div>


        {/* 등록된 태그 목록 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32 }}>
          {tags.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)' }}>
              등록된 배틀태그 없음
            </span>
          ) : tags.map((tag, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 'var(--r-pill)',
              background: 'var(--surface-input)', border: '1px solid var(--border-line)',
              fontSize: 12, fontFamily: 'var(--font-numeral)', color: 'var(--text-high)',
            }}>
              {tag}
              <button
                onClick={() => removeTag(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', fontSize: 11, lineHeight: 1, padding: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
              >✕</button>
            </span>
          ))}
        </div>

        {/* 태그 추가 입력 */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="배틀넷 닉네임"
            style={{
              flex: 1, height: 36, padding: '0 10px',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
              background: 'var(--surface-input)', color: 'var(--text-high)',
              fontFamily: 'var(--font-numeral)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!input.trim()}
            style={{
              height: 36, padding: '0 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border-line)', background: 'transparent',
              color: input.trim() ? 'var(--cheese-green)' : 'var(--text-faint)',
              fontFamily: 'var(--font-ui)', fontSize: 13, cursor: input.trim() ? 'pointer' : 'default',
            }}
          >추가</button>
        </div>

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
          <button type="button" onClick={handleSave} disabled={saving} style={{
            height: 44, borderRadius: 'var(--r-sm)', border: 'none',
            background: saving ? 'var(--surface-raise)' : 'var(--cheese-green)',
            color: saving ? 'var(--text-faint)' : 'var(--text-on-green)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
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
            <label style={LABEL}>배틀넷 닉네임 (선택)</label>
            <input value={battleTag} onChange={e => setBattleTag(e.target.value)}
              placeholder="Cheese" style={INPUT} />
          </div>
        </div>

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
            background: adding || !name.trim() ? 'var(--surface-raise)' : 'var(--cheese-green)',
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
  const { isStreamer, isAdmin } = useAuth();
  const bp = useBreakpoint();

  // bp별 카드 크기 · 행 개수 · 닉네임 폰트 크기
  const { cardHex, rowFull, nameFontSize } = useMemo(() => {
    if (bp === 'mobile')  return { cardHex: 120, rowFull: 2, nameFontSize: 13 };
    if (bp === 'tablet')  return { cardHex: 160, rowFull: 3, nameFontSize: 14 };
    return                       { cardHex: 200, rowFull: 5, nameFontSize: 16 };
  }, [bp]);

  // 캐시가 있으면 첫 렌더부터 데이터로 그려 스피너·재요청을 건너뛴다 (SPA 재방문 시)
  const cachedStreamers = getCachedStreamers();
  const [streamers, setStreamers] = useState<Streamer[]>(cachedStreamers ?? []);
  const [loading,   setLoading]   = useState(cachedStreamers === null);
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);
  // gameNames 편집 모달 대상 스트리머 (null이면 닫힘)
  const [editGameNamesTarget, setEditGameNamesTarget] = useState<Streamer | null>(null);

  async function load() {
    const list = await getStreamers();
    setStreamers(list);
    setLoading(false);
    void refreshStaleProfiles(list);
  }

  // chzzkId가 있고 TTL이 지난(또는 한 번도 안 받은) 스트리머의 프로필 사진을
  // 치지직에서 일괄 조회해 Firestore와 화면에 반영. 실패한 건 다음 로드에서 재시도.
  async function refreshStaleProfiles(list: Streamer[]) {
    const stale = list.filter(isProfileStale);
    if (stale.length === 0) return;

    const profiles = await fetchChzzkProfiles(
      stale.map(s => s.chzzkId).filter((v): v is string => !!v),
    );
    const updates = stale
      .map(s => ({ id: s.id, url: s.chzzkId ? profiles[s.chzzkId]?.imageUrl : undefined }))
      .filter((u): u is { id: string; url: string } => u.url !== undefined);
    if (updates.length === 0) return;

    await Promise.allSettled(updates.map(u => updateStreamerProfileImage(u.id, u.url)));

    const now = new Date();
    setStreamers(prev => prev.map(s => {
      const u = updates.find(x => x.id === s.id);
      return u ? { ...s, profileImageUrl: u.url, profileImageUpdatedAt: now } : s;
    }));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(s: Streamer) {
    if (!confirm(`"${s.name}"을(를) 삭제하시겠습니까?\n\n경기 기록은 유지되지만 해당 스트리머와의 연동이 끊깁니다. 다시 추가해도 기존 전적이 자동으로 복구되지 않습니다.`)) return;
    await deleteStreamer(s.id);
    setStreamers(prev => prev.filter(x => x.id !== s.id));
  }

  // 검색 필터 후 가나다순 정렬 (복사본에서 — 원본 state 불변 유지)
  const filtered = sortStreamersByName(
    streamers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())),
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

      {/* 검색 — 상단 */}
      <div style={{ display: 'flex', alignItems: 'center',
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
        <Honeycomb rowFull={rowFull} cardHex={cardHex}>
          {filtered.map(s => (
            <StreamerCard
              key={s.id}
              streamer={s}
              onOpen={() => router.push(`/streamers/${s.id}`)}
              onDelete={() => handleDelete(s)}
              onEditGameNames={() => setEditGameNamesTarget(s)}
              canEdit={isStreamer}
              canDelete={isAdmin}
              cardHex={cardHex}
              nameFontSize={nameFontSize}
            />
          ))}
        </Honeycomb>
      )}

      {/* FAB — 하단 우측, streamer 이상만 */}
      {isStreamer && <button
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
      </button>}

      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdded={load} />
      )}

      {editGameNamesTarget && (
        <EditGameNamesModal
          streamer={editGameNamesTarget}
          onClose={() => setEditGameNamesTarget(null)}
          onSaved={updated => {
            // 로컬 state 즉시 반영 — Firestore 재조회 없이 UI 갱신
            setStreamers(prev => prev.map(s => s.id === updated.id ? updated : s));
            setEditGameNamesTarget(null);
          }}
        />
      )}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
