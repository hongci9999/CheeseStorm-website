import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/api-auth';
import { addMatch, linkMatchToTournament } from '@/lib/firestore-admin';
import type { Match } from '@/lib/types';

export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  const data = (await req.json()) as Omit<Match, 'id' | 'createdAt'> & { date: string } & {
    tournamentTeams?: { blue: string; red: string } | null;
  };
  const { tournamentTeams, ...matchData } = data;
  const id = await addMatch({ ...matchData, date: new Date(data.date) });
  if (tournamentTeams) {
    await linkMatchToTournament(id, tournamentTeams.blue, tournamentTeams.red);
    revalidateTag('tournamentGames', 'max');
  }
  revalidateTag('matches', 'max');
  return NextResponse.json({ id });
}
