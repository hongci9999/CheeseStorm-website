import { getMatchesCachedServer, getStreamersCachedServer } from '@/lib/firestore.server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { cookies } from 'next/headers';
import MatchesClient from '@/components/matches-client';

export default async function MatchesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isStreamer = session?.role === 'streamer' || session?.role === 'admin';

  const [streamers, matches] = await Promise.all([
    getStreamersCachedServer(),
    getMatchesCachedServer(),
  ]);

  return (
    <MatchesClient
      matches={matches}
      streamers={streamers}
      isStreamer={isStreamer}
    />
  );
}
