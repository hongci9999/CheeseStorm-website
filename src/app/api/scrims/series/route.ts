import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { setScrimsSeries } from '@/lib/firestore-admin';

// 과거 기록 등 여러 스크림 문서를 한 세트(seriesId)로 묶거나(문자열) 해제(null)한다.
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const body = await req.json() as { ids?: unknown; seriesId?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length < 2 || !body.ids.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: '2개 이상의 경기를 선택해주세요' }, { status: 400 });
  }
  if (body.seriesId !== null && typeof body.seriesId !== 'string') {
    return NextResponse.json({ error: '세트 식별자가 올바르지 않습니다' }, { status: 400 });
  }

  await setScrimsSeries(body.ids, body.seriesId);
  revalidateTag('scrims', 'max');
  return NextResponse.json({ ok: true });
}
