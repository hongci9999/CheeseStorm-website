import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { upsertOcrCorrection } from '@/lib/firestore-admin';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { kind, wrong, correct } = (await req.json()) as {
    kind: 'streamer' | 'hero';
    wrong: string;
    correct: string;
  };
  await upsertOcrCorrection(kind, wrong, correct);
  return NextResponse.json({ ok: true });
}
