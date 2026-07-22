import type { CSSProperties } from 'react';

// 육각 아바타 오른쪽 아래 왕관 스티커 — 우승팀 스트리머 표시. 서버 컴포넌트에서도 안전.
// avatarSize 기준(104px)으로 비율 스케일 — 프로필·목록 공용. title로 호버 툴팁 제공.
const BASE_SIZE = 104;

function stickerStyle(avatarSize: number): CSSProperties {
  const s = avatarSize / BASE_SIZE;
  return {
    position: 'absolute',
    bottom: 14 * s,
    right: 10 * s,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26 * s,
    height: 26 * s,
    borderRadius: '50%',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--cheese-green) 70%, white) 0%, var(--cheese-green) 100%)',
    border: `${Math.max(1, 1.5 * s)}px solid color-mix(in srgb, var(--cheese-green) 80%, white)`,
    boxShadow: '0 1px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
    fontSize: 13 * s,
    lineHeight: 1,
    cursor: 'default',
    zIndex: 10,
  };
}

export function CrownSticker({ avatarSize = BASE_SIZE }: { avatarSize?: number }) {
  return (
    <span style={stickerStyle(avatarSize)} title="2026 여름시즌 우승자">
      🏆
    </span>
  );
}
