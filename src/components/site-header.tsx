'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { resolveTheme, type Theme } from '@/lib/theme';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { useAuth, invalidateAuthCache } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type { AppRole } from '@/lib/session';

function NicknameDisplay({ name, role }: { name: string; role: AppRole }) {
  const base: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: 13,
    maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  if (role === 'admin') {
    return (
      <span title="운영자" style={{ ...base, color: '#facc15' }}>
        {name}
      </span>
    );
  }

  if (role === 'streamer') {
    return (
      <span title="스트리머" style={{ ...base, color: 'var(--accent)' }}>
        {name}
      </span>
    );
  }

  return (
    <span style={{ ...base, color: 'var(--text-muted)', maxWidth: 100 }}>
      {name}
    </span>
  );
}

const STORAGE_KEY = 'cs-theme';

const NAV_ITEMS = [
  { href: '/tierlist', ko: '티어리스트',   en: 'Tier List'    },
  { href: '/matches',  ko: '내전기록실',   en: 'Match Room'   },
  { href: '/streamers',ko: '스트리머',     en: 'Roster'       },
  { href: '/mock-draft', ko: '모의밴픽',   en: 'Mock Draft'   },
  { href: '/scrims',   ko: '프로 스크림',       en: 'Scrim'        },
  { href: '/tournament', ko: '대회',        en: 'Tournament'   },
  // 사용방법은 네비 칸 절약을 위해 우측 ? 아이콘으로 이동 (모바일은 하단 탭 유지)
] as const;

export default function SiteHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);
  const { session, loading, isStreamer } = useAuth();
  const bp = useBreakpoint();
  const isMobile = bp !== 'desktop';

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const t = resolveTheme(stored);
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
    setMounted(true);
  }, []);

  function toggleTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    invalidateAuthCache();
    window.location.href = '/';
  }

  // 활성 네비 판별: /matches/new → /matches 활성, / 는 정확히 일치
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 'var(--z-header)',
      height: isMobile ? 52 : 68,
      background: 'color-mix(in srgb, var(--bg-app) 80%, transparent)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      borderBottom: '1px solid var(--border-line)',
    }}>
      <div style={{
        maxWidth: 'var(--container)', margin: '0 auto',
        padding: '0 var(--sp-6)', height: '100%',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-6)',
      }}>
        {/* 브랜드 */}
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none',
          flexShrink: 0,
        }}>
          <Image src="/assets/logo-emblem.png" alt="CHEESESTORM" width={36} height={36} />
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
            letterSpacing: '0.04em', color: 'var(--text-strong)',
          }}>
            CHEESE<span style={{ color: 'var(--accent)' }}>STORM</span>
          </span>
        </Link>

        {/* 네비 탭 — desktop만 */}
        {!isMobile && <nav style={{ display: 'flex', gap: 2 }}>
          {NAV_ITEMS.map(({ href, ko, en }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 1,
                  padding: '9px 13px', borderRadius: 'var(--r-sm)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                  color: active ? 'var(--text-strong)' : 'var(--text-muted)',
                  textDecoration: 'none', position: 'relative',
                  transition: 'color var(--dur-fast) var(--ease-out)',
                }}
              >
                <span>{ko}</span>
                <span style={{
                  fontFamily: 'var(--font-numeral)', fontSize: 9.5,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: active ? 'var(--text-muted)' : 'var(--text-faint)',
                }}>
                  {en}
                </span>
                {active && (
                  <span style={{
                    position: 'absolute', left: 13, right: 13, bottom: -1, height: 2,
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent)',
                    borderRadius: 2,
                  }} />
                )}
              </Link>
            );
          })}
        </nav>}

        {/* 스페이서 */}
        <div style={{ flex: 1 }} />

        {/* 오프라인 뱃지 — desktop만 */}
        {!isMobile && !isFirebaseConfigured && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22,
            padding: '0 8px', borderRadius: 'var(--r-xs)',
            background: 'color-mix(in srgb, var(--tier-b) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--tier-b) 30%, transparent)',
            color: 'var(--tier-b)',
            fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.08em',
          }}>
            오프라인
          </span>
        )}

        {/* + 경기 입력 CTA — desktop + streamer만 */}
        {!isMobile && isStreamer && (
          <Link href="/matches/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 'var(--control-sm)', padding: '0 var(--sp-4)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--cheese-green)',
            color: 'var(--text-on-green)',
            fontFamily: 'var(--font-ui)', fontWeight: 700,
            fontSize: 'var(--fs-xs)', letterSpacing: 'var(--ls-wide)',
            textTransform: 'uppercase', textDecoration: 'none',
            transition: 'background var(--dur-fast) var(--ease-out)',
          }}>
            + 경기 입력
          </Link>
        )}

        {/* 로그인 / 유저 정보 — desktop만 */}
        {!isMobile && !loading && (
          session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <NicknameDisplay name={session.name} role={session.role} />
              <button
                onClick={handleLogout}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border-line)', background: 'transparent',
                  color: 'var(--text-faint)', fontFamily: 'var(--font-ui)',
                  fontSize: 12, cursor: 'pointer',
                  transition: 'color var(--dur-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-high)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 'var(--control-sm)', padding: '0 var(--sp-4)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-line)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', fontWeight: 700,
                fontSize: 'var(--fs-xs)', letterSpacing: 'var(--ls-wide)',
                textTransform: 'uppercase', textDecoration: 'none',
                transition: 'color var(--dur-fast)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-high)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Image src="/assets/chzzk-logo.png" alt="치지직" width={16} height={16} style={{ borderRadius: 4 }} />
              스트리머 로그인
            </a>
          )
        )}

        {/* 사용방법 — 네비 대신 ? 아이콘 (desktop만, 모바일은 하단 탭) */}
        {!isMobile && (
          <Link href="/guide" title="사용방법" aria-label="사용방법"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 'var(--r-pill)',
              border: `1px solid ${isActive('/guide') ? 'var(--accent)' : 'var(--border-line)'}`,
              background: isActive('/guide')
                ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
              color: isActive('/guide') ? 'var(--accent)' : 'var(--text-faint)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              textDecoration: 'none',
              transition: 'color var(--dur-fast), border-color var(--dur-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-high)')}
            onMouseLeave={e => (e.currentTarget.style.color = isActive('/guide') ? 'var(--accent)' : 'var(--text-faint)')}
          >
            ?
          </Link>
        )}

        {/* 테마 토글 */}
        {mounted && (
          <div style={{
            display: 'inline-flex', padding: 3,
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--border-line)',
            background: 'var(--surface-rail)', gap: 2,
          }}>
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggleTheme(t)}
                title={t === 'dark' ? '다크' : '라이트'}
                style={{
                  appearance: 'none', border: 'none', cursor: 'pointer',
                  width: 30, height: 26, borderRadius: 'var(--r-pill)',
                  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: theme === t ? 'var(--accent)' : 'transparent',
                  color: theme === t ? 'var(--text-on-green)' : 'var(--text-faint)',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}
              >
                {t === 'dark' ? '☾' : '☀'}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
