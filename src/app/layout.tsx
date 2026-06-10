import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cheesestorm - 치지직 히오스 내전',
  description: '치지직 스트리머들의 히어로즈 오브 더 스톰 내전 결과 및 티어리스트',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${geist.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-amber-400 hover:text-amber-300 transition-colors">
              🧀 Cheesestorm
            </Link>
            <nav className="flex gap-6 text-sm text-slate-400">
              <Link href="/" className="hover:text-slate-100 transition-colors">
                티어리스트
              </Link>
              <Link href="/matches" className="hover:text-slate-100 transition-colors">
                경기 결과
              </Link>
              <Link href="/streamers" className="hover:text-slate-100 transition-colors">
                스트리머
              </Link>
              <Link href="/matches/new" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                + 경기 입력
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
