'use client';

import React from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';

interface ProfileLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

// 프로필 페이지 반응형 레이아웃 래퍼.
// desktop(≥1024px): grid 310px 1fr, 사이드바 sticky
// mobile/tablet(<1024px): flex column, 사이드바 위, 탭 아래
export function ProfileLayout({ sidebar, children }: ProfileLayoutProps) {
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  if (isDesktop) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '310px 1fr',
        gap: 'var(--sp-5)',
        alignItems: 'start',
        padding: 'var(--sp-7) 0 var(--sp-20)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
          position: 'sticky',
          top: 88,
        }}>
          {sidebar}
        </div>
        {children}
      </div>
    );
  }

  // mobile / tablet
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-5)',
      padding: 'var(--sp-5) 0 var(--sp-20)',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)',
      }}>
        {sidebar}
      </div>
      {children}
    </div>
  );
}
