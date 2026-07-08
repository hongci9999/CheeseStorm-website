'use client';

// 가이드 페이지 전용 배너 — 등록된 스트리머(또는 운영자) 로그인 시에만 노출.
// 본문 우측 여백 맨 위에 화면 고정(position:fixed) — guide/page.tsx에서만 렌더링.
// 뷰포트 좁으면(우측 여백 부족) CSS로 숨김 — globals.css .side-banner 참고.

import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';

const FORM_URL = 'https://forms.gle/Mi14BR45GoP9EU7C7';

export function SideBanner() {
  const { isStreamer } = useAuth();

  if (!isStreamer) return null;

  return (
    <a
      href={FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="side-banner"
    >
      <Image src="/banner/banner.png" alt="설문 참여" width={160} height={397} priority={false} />
    </a>
  );
}
