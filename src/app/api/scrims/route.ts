import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { addScrim, getSeriesPickedHeroes } from '@/lib/firestore-admin';
import { validateScrimPayload, checkFearlessConflict, type Scrim } from '@/lib/scrim';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const data = (await req.json()) as Omit<Scrim, 'id' | 'createdAt'> & { date: string };
  const error = validateScrimPayload(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // 하드 피어리스 위반은 클라이언트 엔진이 먼저 막지만, 세션이 끊겼다 이어지거나
  // 다른 탭에서 같은 세트를 이어 쓰면 뚫린다 — 저장 직전 서버에서 한 번 더 확인.
  if (data.seriesId) {
    const conflict = checkFearlessConflict(data.picks, await getSeriesPickedHeroes(data.seriesId));
    if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });
  }

  const id = await addScrim({ ...data, date: new Date(data.date) });
  revalidateTag('scrims', 'max');
  return NextResponse.json({ id });
}
