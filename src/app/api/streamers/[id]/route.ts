import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import {
  deleteStreamer,
  updateStreamerInfo,
  updateStreamerGameNames,
  updateStreamerProfileImage,
} from '@/lib/firestore-admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await req.json() as {
    action: 'info' | 'gameNames' | 'profileImage';
    name?: string;
    accountLevel?: number;
    gameNames?: string[];
    imageUrl?: string;
  };

  if (body.action === 'info') {
    await updateStreamerInfo(id, body.name!, body.accountLevel);
  } else if (body.action === 'gameNames') {
    await updateStreamerGameNames(id, body.gameNames!);
  } else if (body.action === 'profileImage') {
    await updateStreamerProfileImage(id, body.imageUrl!);
  } else {
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  }

  revalidateTag('streamers', 'max');
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await deleteStreamer(id);
  revalidateTag('streamers', 'max');
  return NextResponse.json({ ok: true });
}
