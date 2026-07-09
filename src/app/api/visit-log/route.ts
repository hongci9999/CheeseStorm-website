import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logTierlistVisit } from '@/lib/firestore-admin';

// 미들웨어가 티어리스트('/') 방문 시 호출 — 스트리머 이상만 통과 (viewer는 401)
export async function POST() {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  await logTierlistVisit(auth.session);
  return NextResponse.json({ ok: true });
}
