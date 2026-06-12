'use client';

import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from '@/lib/firestore';
import {
  type DataSource,
  readDataSourceCookieClient,
  writeDataSourceCookieClient,
  resolveUseMock,
} from '@/lib/data-source';

// 테스트용 토글 — 더미 데이터 / 실제 DB 표시 전환.
// 쿠키 기록 후 새로고침해 서버 컴포넌트(상세 페이지)에도 반영.
export default function DataSourceToggle() {
  const [mounted, setMounted] = useState(false);
  const [useMock, setUseMock] = useState(true);

  useEffect(() => {
    const override = readDataSourceCookieClient();
    setUseMock(resolveUseMock(override, isFirebaseConfigured));
    setMounted(true);
  }, []);

  function pick(next: DataSource) {
    writeDataSourceCookieClient(next);
    // 서버 컴포넌트까지 새 쿠키로 다시 렌더되도록 전체 리로드
    window.location.reload();
  }

  if (!mounted) return null;

  const opts: { v: DataSource; label: string; title: string }[] = [
    { v: 'mock', label: '더미', title: '더미(mock) 데이터 표시' },
    { v: 'firebase', label: 'DB', title: '실제 Firestore 표시' },
  ];
  const current: DataSource = useMock ? 'mock' : 'firebase';

  return (
    <div
      title="테스트용 데이터 소스"
      style={{
        display: 'inline-flex', padding: 3, borderRadius: 'var(--r-pill)',
        border: '1px solid var(--border-line)', background: 'var(--surface-rail)', gap: 2,
      }}
    >
      {opts.map(({ v, label, title }) => {
        const active = current === v;
        return (
          <button
            key={v}
            onClick={() => pick(v)}
            title={title}
            style={{
              appearance: 'none', border: 'none', cursor: 'pointer',
              height: 26, padding: '0 10px', borderRadius: 'var(--r-pill)',
              fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
              letterSpacing: '0.04em',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--text-on-green)' : 'var(--text-faint)',
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
