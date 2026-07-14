import { unstable_cache } from 'next/cache';
import { getMatchesCachedServer } from '@/lib/firestore.server';
import { calcAllElosWithDetails } from '@/lib/elo';

// 전 선수 Elo 계산 과정 — 경기 원본에서만 파생되므로 matches 태그가 무효화될 때만 재계산.
// (경기 추가·수정·삭제 시 revalidateTag('matches') 발생)
// 응답이 JSON 직렬화되므로 EloMatchDetail.date는 어차피 문자열로 나간다 — 캐시 경유해도 동일.
const getEloDetails = unstable_cache(
  async () => calcAllElosWithDetails(await getMatchesCachedServer()),
  ['elo-details'],
  { tags: ['matches'] },
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const streamerId = searchParams.get('streamerId');

    if (!streamerId) {
      return Response.json({ error: 'streamerId required' }, { status: 400 });
    }

    const allDetails = await getEloDetails();
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
