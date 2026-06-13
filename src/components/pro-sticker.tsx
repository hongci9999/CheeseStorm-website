import type { CSSProperties } from 'react';

// 육각 아바타 왼쪽 위 동그란 PRO 스티커 — 서버 컴포넌트에서도 안전.
// avatarSize 기준(104px)으로 비율 스케일 — 프로필·목록 공용.
const BASE_SIZE = 104;

function stickerStyle(avatarSize: number): CSSProperties {
  const s = avatarSize / BASE_SIZE;
  return {
    position: 'absolute',
    top: 14 * s,
    left: 10 * s,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26 * s,
    height: 26 * s,
    borderRadius: '50%',
    background:
      'linear-gradient(145deg, var(--tier-b) 0%, color-mix(in srgb, var(--tier-a) 65%, var(--tier-b)) 100%)',
    border: `${Math.max(1, 1.5 * s)}px solid color-mix(in srgb, var(--tier-b) 80%, white)`,
    boxShadow: '0 1px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: 8.5 * s,
    letterSpacing: '0.03em',
    color: '#1a1000',
    lineHeight: 1,
    pointerEvents: 'none',
    zIndex: 10,
  };
}

export function ProSticker({ avatarSize = BASE_SIZE }: { avatarSize?: number }) {
  return <span style={stickerStyle(avatarSize)}>PRO</span>;
}
