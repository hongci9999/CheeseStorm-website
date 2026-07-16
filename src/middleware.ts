// 라우트 보호 미들웨어 — Edge Runtime 호환 (jose 사용).
// /matches/new : streamer 이상 필요.

import { type NextRequest, type NextFetchEvent, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Next.js Link 뷰포트 prefetch 요청 제외 — 실제 방문(클릭·주소창 진입)만 로그
  // next-router-prefetch: 풀 페이지 prefetch, next-router-segment-prefetch: 세그먼트 단위 prefetch (Next 15)
  const isPrefetch =
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.has('next-router-segment-prefetch');

  // 실시간 접속 확인용 로그 — Vercel Runtime Logs에서 확인 (누가 어떤 페이지 보는지)
  if (!isPrefetch) {
    console.log(
      `[visit] ${pathname} | ${session ? `${session.name}(${session.chzzkId})` : 'anonymous'}`
    );
  }

  // 티어리스트 방문 로그 — 스트리머 이상만, Firestore에 영구 저장 (Vercel 로그는 1시간 후 소멸)
  if (!isPrefetch && pathname === '/' && session && session.role !== 'viewer') {
    const logUrl = new URL('/api/visit-log', req.nextUrl.origin);
    event.waitUntil(
      fetch(logUrl, {
        method: 'POST',
        headers: { cookie: req.headers.get('cookie') ?? '' },
      }).catch(() => {}),
    );
  }

  if (pathname.startsWith('/matches/new') || pathname.startsWith('/scrims/new')) {
    if (!session || session.role === 'viewer') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.\\w+$).*)'],
};
