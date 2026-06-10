'use client';

import { useEffect, useState } from 'react';
import { getStreamers, addStreamer, deleteStreamer, isFirebaseConfigured } from '@/lib/firestore';
import { validateStreamerForm } from '@/lib/streamer';
import type { Streamer, Role } from '@/lib/types';
import { MOCK_STREAMERS } from '@/test/fixtures';

const ROLES: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

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

export default function StreamersPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [name,      setName]      = useState('');
  const [chzzkId,   setChzzkId]   = useState('');
  const [role,      setRole]      = useState<Role | ''>('');
  const [adding,    setAdding]    = useState(false);
  const [error,     setError]     = useState('');

  async function load() {
    if (!isFirebaseConfigured) { setStreamers(MOCK_STREAMERS); setLoading(false); return; }
    const list = await getStreamers();
    setStreamers(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const v = validateStreamerForm(name, role || undefined);
    if (!v.valid) { setError(v.error); return; }
    setAdding(true); setError('');
    try {
      await addStreamer({
        name: name.trim(),
        chzzkId: chzzkId.trim() || undefined,
        role: role || undefined,
      });
      setName(''); setChzzkId(''); setRole('');
      await load();
    } catch {
      setError('추가 중 오류가 발생했습니다.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(s: Streamer) {
    if (!confirm(`"${s.name}"을(를) 삭제하시겠습니까?`)) return;
    await deleteStreamer(s.id);
    setStreamers(prev => prev.filter(x => x.id !== s.id));
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
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

      {/* 추가 폼 */}
      <form onSubmit={handleAdd} style={{
        background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
        marginBottom: 'var(--sp-6)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'block', marginBottom: 'var(--sp-4)' }}>
          새 스트리머 추가
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-3)' }}>
          <div>
            <label style={LABEL}>이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="닉네임" required style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>치지직 채널 ID (선택)</label>
            <input value={chzzkId} onChange={e => setChzzkId(e.target.value)}
              placeholder="채널 ID" style={INPUT} />
          </div>
        </div>

        {/* 역할 선택 */}
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label style={LABEL}>포지션 (선택)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <button key={r} type="button" onClick={() => setRole(role === r ? '' : r)} style={{
                height: 32, padding: '0 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                border: `1px solid ${role === r ? ROLE_COLOR[r] : 'var(--border-line)'}`,
                background: role === r
                  ? `color-mix(in srgb, ${ROLE_COLOR[r]} 15%, transparent)`
                  : 'transparent',
                color: role === r ? ROLE_COLOR[r] : 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
                transition: 'all var(--dur-fast) var(--ease-out)',
              }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12.5, color: 'var(--loss)', fontFamily: 'var(--font-ui)',
            marginBottom: 'var(--sp-3)' }}>{error}</p>
        )}

        <button type="submit" disabled={adding || !name.trim()} style={{
          width: '100%', height: 44, borderRadius: 'var(--r-sm)', border: 'none',
          background: adding || !name.trim() ? 'var(--ink-700)' : 'var(--cheese-green)',
          color: adding || !name.trim() ? 'var(--text-faint)' : 'var(--text-on-green)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          cursor: adding || !name.trim() ? 'not-allowed' : 'pointer',
          transition: 'background var(--dur-fast) var(--ease-out)',
        }}>
          {adding ? '추가 중...' : '추가'}
        </button>
      </form>

      {/* 스트리머 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 'var(--sp-8)' }}>
          불러오는 중...
        </div>
      ) : streamers.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 'var(--sp-8)',
          fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          등록된 스트리머가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {streamers.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              height: 56, padding: '0 var(--sp-4)',
              background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-line)',
            }}>
              {/* 이니셜 */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 'var(--r-sm)', flexShrink: 0,
                background: 'var(--surface-raise)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                color: s.role ? ROLE_COLOR[s.role] : 'var(--text-muted)',
              }}>
                {s.name.slice(0, 2)}
              </span>

              {/* 이름 */}
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                color: 'var(--text-high)', flex: 1 }}>
                {s.name}
              </span>

              {/* 포지션 뱃지 */}
              {s.role && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
                  borderRadius: 'var(--r-xs)',
                  background: `color-mix(in srgb, ${ROLE_COLOR[s.role]} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ROLE_COLOR[s.role]} 35%, transparent)`,
                  color: ROLE_COLOR[s.role],
                  fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.04em',
                }}>
                  {s.role}
                </span>
              )}

              {/* 치지직 링크 */}
              {s.chzzkId && (
                <a href={`https://chzzk.naver.com/${s.chzzkId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-numeral)', fontSize: 11.5,
                    color: 'var(--text-faint)', textDecoration: 'none',
                    transition: 'color var(--dur-fast) var(--ease-out)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--cheese-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}>
                  치지직 ↗
                </a>
              )}

              {/* 삭제 */}
              <button onClick={() => handleDelete(s)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                borderRadius: 'var(--r-xs)', color: 'var(--text-faint)', fontSize: 12,
                transition: 'color var(--dur-fast) var(--ease-out)',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 'var(--sp-20)' }} />
    </div>
  );
}
