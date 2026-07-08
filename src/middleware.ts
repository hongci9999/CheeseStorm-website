// 라우트 보호 미들웨어 — Edge Runtime 호환 (jose 사용).
// /matches/new : streamer 이상 필요.

import { type NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === '/') {
    // 실시간 접속 확인용 로그 — Vercel Runtime Logs에서 확인 (티어리스트 페이지 조회자)
    console.log(
      `[visit] ${pathname} | ${session ? `${session.name}(${session.chzzkId})` : 'anonymous'}`
    );
  }

  if (pathname.startsWith('/matches/new')) {
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
  matcher: ['/', '/matches/new'],
};
