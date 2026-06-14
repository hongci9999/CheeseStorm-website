'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  required: '로그인이 필요한 기능입니다.',
  error: '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.',
};

export function AuthToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const auth = searchParams.get('auth');
    if (!auth || !MESSAGES[auth]) return;

    setMsg(MESSAGES[auth]);

    // URL에서 ?auth= 제거
    const next = new URLSearchParams(searchParams.toString());
    next.delete('auth');
    const qs = next.toString();
    router.replace(pathname + (qs ? `?${qs}` : ''), { scroll: false });

    const timer = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(timer);
  // searchParams가 바뀔 때만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!msg) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-raise)',
        border: '1px solid var(--loss)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--text-high)',
        whiteSpace: 'nowrap',
        animation: 'fadeInUp 0.2s var(--ease-out)',
      }}
    >
      <span style={{ color: 'var(--loss)', fontSize: 16 }}>⚠</span>
      {msg}
      <button
        type="button"
        onClick={() => setMsg(null)}
        style={{
          marginLeft: 8, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: 0,
        }}
        aria-label="닫기"
      >✕</button>
    </div>
  );
}
