// 치지직 OAuth 로그인 시작 — Chzzk 인가 페이지로 redirect.
// CSRF 방어용 state를 생성해 httpOnly 쿠키에 저장.

import { NextResponse } from 'next/server';
import { buildChzzkAuthUrl } from '@/lib/chzzk-auth';

export function GET() {
  const state = crypto.randomUUID();
  const authUrl = buildChzzkAuthUrl(state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('cs-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5분
    path: '/',
  });
  return res;
}
