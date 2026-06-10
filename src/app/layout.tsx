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
