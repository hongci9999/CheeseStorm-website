import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { saveCuratedTierLists } from '@/lib/firestore-admin';
import type { CuratedTierLists } from '@/lib/types';

export async function PUT(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const lists = (await req.json()) as CuratedTierLists;
  await saveCuratedTierLists(lists, {
    chzzkId: auth.session.chzzkId,
    name: auth.session.name,
    // 제작자(admin) 또는 개발 세션이면 재조정 안내 유지
    isAdmin: auth.session.role === 'admin' || auth.session.dev === true,
  });
  return NextResponse.json({ ok: true });
}
