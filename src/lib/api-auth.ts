import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE, type SessionPayload } from './session';
import type { AppRole } from './session';

type AuthOk = { ok: true; session: SessionPayload };
type AuthFail = { ok: false; res: NextResponse };

export async function requireRole(minRole: AppRole): Promise<AuthOk | AuthFail> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, res: NextResponse.json({ error: '로그인 필요' }, { status: 401 }) };

  const session = await verifySessionToken(token);
  if (!session) return { ok: false, res: NextResponse.json({ error: '세션 만료' }, { status: 401 }) };

  const rank: Record<AppRole, number> = { viewer: 0, streamer: 1, admin: 2 };
  if (rank[session.role] < rank[minRole]) {
    return { ok: false, res: NextResponse.json({ error: '권한 없음' }, { status: 403 }) };
  }

  return { ok: true, session };
}
