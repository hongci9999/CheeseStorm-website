import { type NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// 백그라운드(waitUntil) 컨텍스트의 revalidateTag가 씹히는 문제 우회용 —
// refreshStats 완료 후 이 라우트를 self-fetch하면 요청 컨텍스트 안에서 무효화가 확실히 전파된다.
// 캐시 퍼지 외 부작용 없음. REVALIDATE_SECRET 설정 시 헤더 일치 요구.
const ALLOWED_TAGS = new Set(['stats', 'matches', 'streamers', 'scrims']);

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const tag = req.nextUrl.searchParams.get('tag') ?? 'stats';
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ error: 'invalid tag' }, { status: 400 });
  }
  revalidateTag(tag, 'max');
  return NextResponse.json({ ok: true, tag });
}
