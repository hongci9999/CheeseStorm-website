import type { Metadata } from 'next';
import { Saira, Saira_Condensed } from 'next/font/google';
import SiteHeader from '@/components/site-header';
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
  icons: {
    icon: '/assets/logo-emblem.png',
    apple: '/assets/logo-emblem.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 테마 플리커 방지: 하이드레이션 전에 data-theme 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
          }}
        />
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
        <SiteHeader />
        <div style={{
          background: 'color-mix(in srgb, var(--hots-purple) 10%, var(--surface-raise))',
          borderBottom: '1px solid color-mix(in srgb, var(--hots-purple) 25%, transparent)',
          padding: '7px var(--sp-6)',
          textAlign: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            치지직에서 진행한 히어로즈 오브 더 스톰 내전만을 이용한 통계입니다.{' '}
            <span style={{ color: 'var(--text-faint)' }}>표본수가 적기에 정확하지 않을 수 있습니다.</span>
          </span>
        </div>
        <main
          style={{
            maxWidth: 'var(--container)',
            margin: '0 auto',
            padding: 'var(--sp-3) var(--sp-6)',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
