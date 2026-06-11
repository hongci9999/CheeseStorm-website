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
  children,
  style,
}: {
  name: string;
  imageUrl?: string;
  ring?: string;       // 외곽 헥사곤 색 (티어색·롤색 등)
  size?: number;
  ringWidth?: number;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const initials = name.trim().slice(0, 2);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, ...style }}>
      {/* 외곽 링 — 색 헥사곤 */}
      <span style={{
        position: 'absolute', inset: 0,
        background: ring, clipPath: HEX_CLIP, padding: ringWidth, display: 'flex',
      }}>
        {/* 내부 헥사곤 — 이미지 또는 이니셜 */}
        <span style={{
          position: 'relative', display: 'flex', width: '100%', height: '100%',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          background: 'var(--surface-raise)', clipPath: HEX_CLIP,
        }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: Math.round(size * 0.34),
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
