import type { MetadataRoute } from 'next';

// 검색엔진에 페이지 목록을 알리는 사이트맵.
// ponytail: 공개 정적 경로만 — 동적 상세(matches/[id], streamers/[id])는
// 색인 필요해지면 Firestore 읽어 추가. 지금은 메인 경로로 충분.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cheesestorm.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/matches', '/streamers', '/guide'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
  }));
}
