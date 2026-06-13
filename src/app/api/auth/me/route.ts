// 현재 세션 조회 — 클라이언트 컴포넌트가 useAuth()로 호출.

import { type NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null);

  const session = await verifySessionToken(token);
  return NextResponse.json(session);
}
