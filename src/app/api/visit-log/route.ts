import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logTierlistVisit } from '@/lib/firestore-admin';

const MAX_PATH_LEN = 200;

// 미들웨어가 페이지 방문 시 호출 — 스트리머 이상만 통과 (viewer는 401)
export async function POST(req: NextRequest) {
  const auth = await requireRole('streamer');
  if (!auth.ok) return auth.res;

  // 경로는 요청에서 오므로 검증 — 사이트 내부 경로만 허용하고 길이 제한
  // ('//host' 형태의 프로토콜 상대 URL 차단, 로그 필드 오염 방지)
  const raw = new URL(req.url).searchParams.get('path') ?? '/';
  const path = raw.startsWith('/') && !raw.startsWith('//')
    ? raw.slice(0, MAX_PATH_LEN)
    : '/';

  await logTierlistVisit(auth.session, path);
  return NextResponse.json({ ok: true });
}
