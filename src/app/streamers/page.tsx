'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, getMatches, addStreamer, deleteStreamer, isFirebaseConfigured } from '@/lib/firestore';
import { validateStreamerForm, parseChzzkId } from '@/lib/streamer';
import { calcPlayerStats } from '@/lib/tier';
import type { Streamer, PlayerStats, Role } from '@/lib/types';
import { MOCK_STREAMERS, MOCK_MATCHES } from '@/test/fixtures';

const ROLE_COLOR: Record<Role, string> = {
  탱커:  'var(--cheese-blue)',
  투사:  'var(--tier-a)',
  암살자:'var(--tier-s)',
  지원가:'var(--tier-c)',
  전문가:'var(--tier-b)',
};

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
function StreamerCard({
  streamer, stats, onOpen, onDelete,
}: {
  streamer: Streamer;
  stats?: PlayerStats;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const role = stats?.role;  // 내전 기록에서 파생된 롤
  const roleColor = role ? ROLE_COLOR[role] : 'var(--text-muted)';

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', cursor: 'pointer',
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: `1px solid ${hover ? 'var(--border-glow)' : 'var(--border-line)'}`,
        boxShadow: hover ? 'var(--glow-green-soft)' : 'var(--shadow-sm)',
        padding: 'var(--sp-5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}
    >
      {/* 삭제 — hover 시만 */}
      {hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 'var(--r-xs)',
            color: 'var(--text-faint)', fontSize: 12,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
        >
          ✕
        </button>
      )}

      {/* 아바타 */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 56, height: 56, borderRadius: '50%',
        background: `color-mix(in srgb, ${roleColor} 10%, var(--surface-raise))`,
        border: `2px solid color-mix(in srgb, ${roleColor} 40%, transparent)`,
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
        color: roleColor,
      }}>
        {streamer.name.slice(0, 2)}
      </span>

      {/* 이름 */}
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15,
        color: 'var(--text-high)', maxWidth: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {streamer.name}
      </span>

      {/* 롤(파생) + 계정레벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22 }}>
        {role && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
            borderRadius: 'var(--r-xs)',
            background: `color-mix(in srgb, ${roleColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${roleColor} 35%, transparent)`,
            color: roleColor,
            fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
          }}>
            {role}
          </span>
        )}
        {streamer.accountLevel != null && (
          <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5,
            color: 'var(--text-faint)' }}>
            Lv.{streamer.accountLevel}
          </span>
        )}
      </div>

      {/* 전적 */}
      <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 12, color: 'var(--text-muted)' }}>
        {stats && stats.totalGames > 0
          ? `${stats.wins}W ${stats.losses}L · ${Math.round(stats.winRate * 100)}%`
          : '경기 기록 없음'}
      </span>

      {/* 치지직 */}
      {streamer.chzzkId && (
        <a href={`https://chzzk.naver.com/${streamer.chzzkId}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
            color: 'var(--text-faint)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--cheese-green)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}>
          치지직 ↗
        </a>
      )}
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

      {/* 검색 — 상단 */}
      <div style={{ position: 'relative', width: 260, marginBottom: 'var(--sp-5)' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }}>⌕</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="스트리머 검색"
          style={{ ...INPUT, paddingLeft: 36 }}
        />
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--sp-4)',
        }}>
          {filtered.map(s => (
            <StreamerCard
              key={s.id}
              streamer={s}
              stats={statsMap.get(s.id)}
              onOpen={() => router.push(`/streamers/${s.id}`)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
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
