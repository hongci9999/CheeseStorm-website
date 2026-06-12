import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelProfiles, isChzzkConfigured } from '@/lib/chzzk';

// 치지직 채널 프로필(이미지·닉네임) 조회 프록시.
// Client-Secret을 클라이언트에 노출하지 않기 위해 서버에서만 호출한다.
// GET /api/chzzk-profile?channelIds=abc,def
// → { configured: boolean, profiles: { [channelId]: { name, imageUrl, ... } } }
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('channelIds') ?? '';
  const channelIds = raw.split(',').map((s) => s.trim()).filter(Boolean);

  if (!isChzzkConfigured()) {
    // 미설정 시에도 200 — 클라이언트가 조용히 폴백(이니셜)하도록.
    return NextResponse.json({ configured: false, profiles: {} });
  }
  if (channelIds.length === 0) {
    return NextResponse.json({ configured: true, profiles: {} });
  }

  const profiles = await fetchChannelProfiles(channelIds);
  return NextResponse.json({ configured: true, profiles });
}
