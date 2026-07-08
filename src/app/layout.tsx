import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Saira, Saira_Condensed } from 'next/font/google';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import BottomTabBar from '@/components/bottom-tab-bar';
import { AuthToast } from '@/components/auth-toast';
import { Analytics } from '@vercel/analytics/next';
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

// 배포 도메인 — 환경변수로 덮어쓸 수 있고, 없으면 Vercel 기본 도메인
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cheesestorm.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 한글 "치즈스톰"을 제목·설명에 포함해야 해당 검색어에 매칭됨
  title: '치즈스톰 (Cheesestorm) — 치지직 히오스 내전 전적·티어표',
  description: '치즈스톰 — 치지직 스트리머들의 히어로즈 오브 더 스톰(HOTS) 내전 전적과 티어리스트',
  keywords: ['치즈스톰', 'Cheesestorm', '치지직', 'HOTS', '히어로즈 오브 더 스톰','히오스', '내전', '티어표', '티어리스트'],
  icons: {
    icon: '/assets/logo-emblem.png',
    apple: '/assets/logo-emblem.png',
  },
  openGraph: {
    title: '치즈스톰 (Cheesestorm) — 치지직 HOTS 내전 전적·티어표',
    description: '치지직 스트리머들의 히어로즈 오브 더 스톰(HOTS) 내전 전적과 티어리스트',
    url: SITE_URL,
    siteName: '치즈스톰',
    locale: 'ko_KR',
    type: 'website',
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
        className={`${saira.variable} ${sairaCondensed.variable} cheese-static-bg min-h-screen flex flex-col`}
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
            flex: 1,            // 콘텐츠 짧아도 main이 늘어 푸터를 최하단으로 밀어냄
            width: '100%',
            maxWidth: 'var(--container)',
            margin: '0 auto',
            padding: 'var(--sp-3) var(--sp-6) calc(var(--sp-3) + 60px)',
          }}
        >
          {children}
        </main>
        <BottomTabBar />
        <a
          href="https://forms.gle/Mi14BR45GoP9EU7C7"
          target="_blank"
          rel="noopener noreferrer"
          className="feedback-bar"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '10px var(--sp-6)',
            background: 'color-mix(in srgb, var(--hots-purple) 22%, var(--surface-raise))',
            borderTop: '1px solid color-mix(in srgb, var(--hots-purple) 35%, transparent)',
            fontFamily: 'var(--font-ui)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-high)',
          }}
        >
          건의사항 · 문의사항 남기기
        </a>
        <SiteFooter />
        <Suspense>
          <AuthToast />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
