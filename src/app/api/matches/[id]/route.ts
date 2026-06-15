import { type NextRequest, NextResponse } from 'next/server';
import { updateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { deleteMatch, updateMatch, updateMatchDate } from '@/lib/firestore-admin';
import type { Match } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await req.json() as
    | { action: 'date'; date: string }
    | ({ action: 'update' } & Omit<Match, 'id' | 'createdAt'> & { date: string });

  if (body.action === 'date') {
    await updateMatchDate(id, new Date(body.date));
  } else if (body.action === 'update') {
    await updateMatch(id, { ...body, date: new Date(body.date) });
  } else {
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  }

  updateTag('matches');
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await deleteMatch(id);
  updateTag('matches');
  return NextResponse.json({ ok: true });
}
