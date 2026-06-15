import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { addMatch } from '@/lib/firestore-admin';
import type { Match } from '@/lib/types';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const data = (await req.json()) as Omit<Match, 'id' | 'createdAt'> & { date: string };
  const id = await addMatch({ ...data, date: new Date(data.date) });
  revalidateTag('matches');
  return NextResponse.json({ id });
}
