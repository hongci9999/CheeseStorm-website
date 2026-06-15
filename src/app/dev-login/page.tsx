'use client';

// 임시 로그인 페이지 — 개발 환경 전용.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DevLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, asAdmin: true, name: 'dev' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '로그인 실패'); return; }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-app)',
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', flexDirection: 'column', gap: 16,
        width: 320, padding: 32,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-line)',
        borderRadius: 'var(--r-lg)',
      }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-strong)' }}>
          임시 로그인 <span style={{ fontSize: 12, color: 'var(--tier-b)', fontWeight: 400 }}>DEV ONLY</span>
        </h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Secret</span>
          <input
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="DEV_LOGIN_SECRET"
            type="password"
            required
            style={{
              padding: '8px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border-line)',
              background: 'var(--bg-app)', color: 'var(--text-high)',
              fontFamily: 'var(--font-ui)', fontSize: 14,
            }}
          />
        </label>

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tier-d)', fontFamily: 'var(--font-ui)' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 0', borderRadius: 'var(--r-sm)',
            background: '#facc15', color: '#1a1a1a',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '로그인 중...' : '관리자로 로그인'}
        </button>
      </form>
    </div>
  );
}
