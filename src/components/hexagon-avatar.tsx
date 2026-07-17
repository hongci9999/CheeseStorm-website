'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Tier } from '@/lib/types';

// 육각형 클립 — 티어리스트·스트리머 카드·상세 프로필 공용
export const HEX_CLIP = 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)';

// 티어 → 테두리 색 토큰 (티어리스트·스트리머 카드 공용)
export const TIER_COLOR_VAR: Record<Tier, string> = {
  S: '--tier-s', A: '--tier-a', B: '--tier-b',
  C: '--tier-c', D: '--tier-d', unranked: '--ink-500',
};

// 치지직 프로필 사진이 있으면 이미지, 없으면 닉네임 이니셜 2자로 폴백.
// children은 내부 헥사곤에 클립되어 렌더 → 하단 그라데이션·텍스트 오버레이용.
export function HexAvatar({
  name,
  imageUrl,
  ring = 'var(--ink-500)',
  size = 54,
  ringWidth = 2,
  ringFixed = false,
  children,
  style,
  imgStyle,
}: {
  name: string;
  imageUrl?: string;
  ring?: string;       // 외곽 헥사곤 색 (티어색·롤색 등). 그라데이션 문자열도 허용.
  size?: number;
  ringWidth?: number;
  ringFixed?: boolean; // true면 ring 배경을 뷰포트 고정(background-attachment:fixed)
                       // → 커서 추적 스포트라이트 글로우를 카드 전체에서 연속으로 표현
  children?: ReactNode;
  style?: CSSProperties;
  imgStyle?: CSSProperties; // 내부 이미지에만 적용 (링 색 영향 없이 흑백 처리 등)
}) {
  // 이미지 로드 실패(파일 없음 등) 시 이니셜로 폴백
  const [broken, setBroken] = useState(false);
  const showImg = !!imageUrl && !broken;
  const initials = name.trim().slice(0, 2);
  // 사진 없는 빈 육각형 — 단색 대신 ring 색을 머금은 그라데이션으로 채워 입체감 부여.
  // ring(티어색·히오스 보라 등)에서 파생 → 테마·색 무관하게 자동으로 어울림.
  const emptyFill =
    `linear-gradient(155deg,` +
    ` color-mix(in srgb, ${ring} 26%, var(--surface-raise)) 0%,` +
    ` color-mix(in srgb, ${ring} 10%, var(--surface-raise)) 52%,` +
    ` var(--surface-raise) 100%)`;
  const initialsColor = `color-mix(in srgb, ${ring} 45%, var(--text-high))`;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, ...style }}>
      {/* 외곽 링 — 색 헥사곤 (ringFixed면 배경을 뷰포트 고정해 스포트라이트 추적) */}
      <span style={{
        position: 'absolute', inset: 0,
        background: ring, clipPath: HEX_CLIP, padding: ringWidth, display: 'flex',
        ...(ringFixed ? { backgroundAttachment: 'fixed' as const } : null),
      }}>
        {/* 내부 헥사곤 — 이미지 또는 이니셜 */}
        <span style={{
          position: 'relative', display: 'flex', width: '100%', height: '100%',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          background: showImg ? 'var(--surface-raise)' : emptyFill, clipPath: HEX_CLIP,
        }}>
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} draggable={false}
              onError={() => setBroken(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', ...imgStyle }} />
          ) : (
            <span style={{
              color: initialsColor, fontFamily: 'var(--font-display)',
              fontWeight: 800, fontSize: Math.round(size * 0.34),
            }}>
              {initials}
            </span>
          )}
          {children}
        </span>
      </span>
    </span>
  );
}
