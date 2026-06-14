'use client';

// 뷰포트 너비에 따라 현재 브레이크포인트를 반환하는 훅.
// SSR 환경에서는 'desktop'을 기본값으로 반환한다.

import { useEffect, useState } from 'react';

export type Bp = 'mobile' | 'tablet' | 'desktop';

function getBreakpoint(): Bp {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Bp {
  const [bp, setBp] = useState<Bp>(getBreakpoint);

  useEffect(() => {
    // SSR에서 'desktop' 기본값으로 렌더된 후 클라이언트 실제 뷰포트로 즉시 보정
    setBp(getBreakpoint());

    let timer: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBp(getBreakpoint()), 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return bp;
}
