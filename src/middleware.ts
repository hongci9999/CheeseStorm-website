// 라우트 보호 미들웨어 — Edge Runtime 호환 (jose 사용).
// /matches/new : streamer 이상 필요.

import { type NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/matches/new')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

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
  matcher: ['/matches/new'],
};
