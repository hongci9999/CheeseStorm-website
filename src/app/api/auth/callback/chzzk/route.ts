// 치지직 OAuth 콜백 — code 교환 → 유저 정보 조회 → 세션 쿠키 발급.

import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getChzzkUserInfo } from '@/lib/chzzk-auth';
import { createSessionToken, SESSION_COOKIE, SESSION_EXPIRY_SEC } from '@/lib/session';
import { resolveRole } from '@/lib/auth-permissions';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('cs-oauth-state')?.value;

  const base = process.env.AUTH_URL ?? req.nextUrl.origin;

  // CSRF 검증
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${base}/?auth=error`);
  }

  try {
    const tokens = await exchangeCodeForToken(code, state);
    const userInfo = await getChzzkUserInfo(tokens.accessToken);
    const role = await resolveRole(userInfo.channelId);

    const sessionToken = await createSessionToken({
      chzzkId: userInfo.channelId,
      name: userInfo.channelName,
      role,
    });

    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_SEC,
      path: '/',
    });
    res.cookies.delete('cs-oauth-state');
    return res;
  } catch (err) {
    console.error('[auth/callback]', err);
    return NextResponse.redirect(`${base}/?auth=error`);
  }
}
