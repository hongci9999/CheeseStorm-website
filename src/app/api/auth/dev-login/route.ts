// 임시 로그인 — 개발 환경 전용. DEV_LOGIN_SECRET으로 게이팅.

import { type NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_EXPIRY_SEC } from '@/lib/session';
import { resolveRole } from '@/lib/auth-permissions';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '프로덕션에서 비활성화' }, { status: 403 });
  }

  const { chzzkId, name, secret } = await req.json();

  if (!secret || secret !== process.env.DEV_LOGIN_SECRET) {
    return NextResponse.json({ error: '잘못된 시크릿' }, { status: 401 });
  }

  if (!chzzkId || !name) {
    return NextResponse.json({ error: 'chzzkId, name 필수' }, { status: 400 });
  }

  const role = await resolveRole(chzzkId);
  const sessionToken = await createSessionToken({ chzzkId, name, role });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_SEC,
    path: '/',
  });
  return res;
}
