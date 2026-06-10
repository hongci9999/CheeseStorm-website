import type { Metadata } from 'next';
import { Saira, Saira_Condensed } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

const saira = Saira({
  subsets: ['latin'],
  variable: '--font-saira',
  weight: ['400', '500', '600', '700', '800'],
});

const sairaCondensed = Saira_Condensed({
  subsets: ['latin'],
  variable: '--font-saira-condensed',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Cheesestorm — HOTS 내전 전적',
  description: '치지직 스트리머들의 히어로즈 오브 더 스톰 내전 결과 및 티어리스트',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${saira.variable} ${sairaCondensed.variable} cheese-static-bg min-h-screen`}
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 'var(--z-header)',
            height: 'var(--header-h)',
            borderBottom: '1px solid var(--border-faint)',
            background: `rgba(10,14,21,0.82)`,
            backdropFilter: `blur(var(--blur-glass))`,
            WebkitBackdropFilter: `blur(var(--blur-glass))`,
          }}
        >
          <div
            style={{
              maxWidth: 'var(--container)',
              margin: '0 auto',
              padding: '0 var(--sp-6)',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* 로고 */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <Image
                src="/assets/logo-emblem.png"
                alt="Cheesestorm"
                width={32}
                height={32}
              />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'var(--fs-lg)',
                  letterSpacing: 'var(--ls-tight)',
                  color: 'var(--text-strong)',
                }}
              >
                CHEESESTORM
              </span>
            </Link>

            {/* 네비게이션 */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <NavLink href="/">티어리스트</NavLink>
              <NavLink href="/matches">경기 결과</NavLink>
              <NavLink href="/streamers">스트리머</NavLink>
              <Link
                href="/matches/new"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 'var(--control-sm)',
                  padding: '0 var(--sp-4)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--cheese-green)',
                  color: 'var(--text-on-green)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-xs)',
                  letterSpacing: 'var(--ls-wide)',
                  textTransform: 'uppercase',
                  transition: `background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
                  marginLeft: 'var(--sp-2)',
                }}
              >
                + 경기 입력
              </Link>
            </nav>
          </div>
        </header>

        <main
          style={{
            maxWidth: 'var(--container)',
            margin: '0 auto',
            padding: 'var(--sp-8) var(--sp-6)',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        height: 'var(--control-sm)',
        padding: '0 var(--sp-3)',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'var(--font-ui)',
        fontWeight: 500,
        fontSize: 'var(--fs-sm)',
        color: 'var(--text-muted)',
        transition: `color var(--dur-fast) var(--ease-out)`,
      }}
    >
      {children}
    </Link>
  );
}
