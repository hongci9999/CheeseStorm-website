import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { deleteScrim } from '@/lib/firestore-admin';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await deleteScrim(id);
  revalidateTag('scrims', 'max');
  return NextResponse.json({ ok: true });
}
