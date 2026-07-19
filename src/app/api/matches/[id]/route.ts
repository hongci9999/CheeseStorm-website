import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import {
  deleteMatch, updateMatch, updateMatchDate,
  linkMatchToTournament, unlinkMatchFromTournament,
} from '@/lib/firestore-admin';
import { getMatch } from '@/lib/firestore';
import type { Match } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await req.json() as
    | { action: 'date'; date: string }
    | ({ action: 'update' } & Omit<Match, 'id' | 'createdAt'> & { date: string } & {
        tournamentTeams?: { blue: string; red: string } | null;
      });

  if (body.action === 'date') {
    await updateMatchDate(id, new Date(body.date));
  } else if (body.action === 'update') {
    const { tournamentTeams, ...rest } = body;
    const existing = await getMatch(id);
    const data = {
      ...rest,
      date: new Date(body.date),
      blueStats: body.blueStats ?? existing?.blueStats,
      redStats: body.redStats ?? existing?.redStats,
    };
    await updateMatch(id, data);
    // undefined = 폼에서 대회 필드를 건드리지 않음(구버전 클라이언트 등) → 기존 태그 유지
    if (tournamentTeams === null) {
      await unlinkMatchFromTournament(id);
      revalidateTag('tournamentGames', 'max');
    } else if (tournamentTeams) {
      await linkMatchToTournament(id, tournamentTeams.blue, tournamentTeams.red);
      revalidateTag('tournamentGames', 'max');
    }
  } else {
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  }

  revalidateTag('matches', 'max');
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await deleteMatch(id);
  await unlinkMatchFromTournament(id); // 고아 태그 정리 — 없어도 조회 시 무해하지만 청소
  revalidateTag('matches', 'max');
  revalidateTag('tournamentGames', 'max');
  return NextResponse.json({ ok: true });
}
