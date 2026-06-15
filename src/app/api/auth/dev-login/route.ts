// 임시 로그인 — 개발 환경 전용. DEV_LOGIN_SECRET으로 게이팅.

import { type NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_EXPIRY_SEC } from '@/lib/session';
import { resolveRole } from '@/lib/auth-permissions';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '프로덕션에서 비활성화' }, { status: 403 });
  }

  const { chzzkId: rawId, name: rawName, secret, asAdmin } = await req.json();

  if (!secret || secret !== process.env.DEV_LOGIN_SECRET) {
    return NextResponse.json({ error: '잘못된 시크릿' }, { status: 401 });
  }

  let chzzkId = rawId as string;
  let name = rawName as string;

  if (asAdmin) {
    const adminId = (process.env.ADMIN_CHZZK_ID ?? '').split(',')[0].trim();
    if (!adminId) return NextResponse.json({ error: 'ADMIN_CHZZK_ID 미설정' }, { status: 500 });
    chzzkId = adminId;
    name = name || '관리자';
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
