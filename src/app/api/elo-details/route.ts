import { getMatchesCachedServer } from '@/lib/firestore.server';
import { calcAllElosWithDetails } from '@/lib/elo';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const streamerId = searchParams.get('streamerId');

    if (!streamerId) {
      return Response.json({ error: 'streamerId required' }, { status: 400 });
    }

    const matches = await getMatchesCachedServer();
    const allDetails = calcAllElosWithDetails(matches);
    const detail = allDetails.find(d => d.streamerId === streamerId);

    if (!detail) {
      return Response.json({ error: 'streamer not found' }, { status: 404 });
    }

    return Response.json(detail);
  } catch {
    console.error('[elo-details] failed');
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}
