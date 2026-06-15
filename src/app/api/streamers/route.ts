import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { addStreamer } from '@/lib/firestore-admin';
import type { Streamer } from '@/lib/types';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const data = (await req.json()) as Omit<Streamer, 'id' | 'createdAt'>;
  const id = await addStreamer(data);
  revalidateTag('streamers', 'max');
  return NextResponse.json({ id });
}
