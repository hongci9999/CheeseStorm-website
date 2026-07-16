'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const TAB_ITEMS = [
  { href: '/',          label: '티어리스트', icon: '★' },
  { href: '/matches',   label: '내전기록실', icon: '⚔' },
  { href: '/streamers', label: '스트리머',   icon: '◈' },
  { href: '/scrims',    label: '스크림',     icon: '⬡' },
  { href: '/guide',     label: '사용방법',   icon: '?' },
] as const;

export default function BottomTabBar() {
  const bp = useBreakpoint();
  const pathname = usePathname();

  // 데스크탑에서는 헤더 네비로 충분하므로 숨김
  if (bp === 'desktop') return null;

  // 활성 탭 판별: /는 정확히 일치, 나머지는 접두사 일치
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav data-testid="bottom-tab-bar" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      height: 60,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      background: 'color-mix(in srgb, var(--bg-app) 90%, transparent)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      borderTop: '1px solid var(--border-line)',
    }}>
      {TAB_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'none',
              color: active ? 'var(--cheese-green)' : 'var(--text-faint)',
              flex: 1,
              padding: '6px 0',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontSize: 10,
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
