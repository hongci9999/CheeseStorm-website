'use client';

// 클라이언트 컴포넌트에서 현재 세션을 읽는 훅.
// SPA 내비게이션 동안 /api/auth/me 중복 호출을 막기 위해 모듈 캐시 사용.

import { useEffect, useState } from 'react';
import type { SessionPayload } from '@/lib/session';

// undefined = 아직 로딩 중, null = 비로그인, SessionPayload = 로그인
let cache: SessionPayload | null | undefined = undefined;
const listeners = new Set<(s: SessionPayload | null) => void>();

function notify(session: SessionPayload | null) {
  cache = session;
  listeners.forEach(fn => fn(session));
}

export function invalidateAuthCache() {
  cache = undefined;
}

export function useAuth() {
  // 모듈 캐시로 lazy 초기화 — 이미 로드됐으면 재요청 없이 즉시 반영
  const [session, setSession] = useState<SessionPayload | null | undefined>(() => cache);

  useEffect(() => {
    const handler = (s: SessionPayload | null) => setSession(s);
    listeners.add(handler);

    // 아직 로드 전일 때만 fetch
    if (cache === undefined) {
      fetch('/api/auth/me')
        .then(r => r.json() as Promise<SessionPayload | null>)
        .then(notify)
        .catch(() => notify(null));
    }

    return () => { listeners.delete(handler); };
  }, []);

  return {
    session,
    loading: session === undefined,
    isStreamer: session?.role === 'streamer' || session?.role === 'admin',
    isAdmin: session?.role === 'admin',
  };
}
