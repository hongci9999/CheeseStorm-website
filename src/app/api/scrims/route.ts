import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { addScrim } from '@/lib/firestore-admin';
import { validateScrimPayload, type Scrim } from '@/lib/scrim';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const data = (await req.json()) as Omit<Scrim, 'id' | 'createdAt'> & { date: string };
  const error = validateScrimPayload(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const id = await addScrim({ ...data, date: new Date(data.date) });
  revalidateTag('scrims', 'max');
  return NextResponse.json({ id });
}
