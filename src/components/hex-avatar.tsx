// 재사용 가능한 육각형 아바타 컴포넌트
// CSS clip-path polygon으로 육각형 구현, 다크/라이트 테마 토큰 사용
// size prop으로 크기 조절 가능 — 이슈 #17, #22에서 공유

interface HexAvatarProps {
  /** 프로필 이미지 URL — 없으면 initials 폴백 */
  src?: string;
  /** 닉네임 이니셜 폴백 텍스트 (보통 name.slice(0, 2)) */
  initials: string;
  /** 픽셀 크기 (기본 80) */
  size?: number;
  /** 테두리 색상 — 티어색 또는 undefined */
  borderColor?: string;
  /** alt 텍스트 */
  alt?: string;
}

// 납작한 육각형(flat-top) clip-path 좌표 (퍼센트)
const HEX_CLIP =
  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

export default function HexAvatar({
  src,
  initials,
  size = 80,
  borderColor,
  alt,
}: HexAvatarProps) {
  // 테두리 시뮬레이션: 바깥 레이어를 약간 크게 그리고 안쪽 이미지 레이어를 덧댐
  const borderWidth = Math.round(size * 0.04); // 크기 비례 테두리
  const outerSize = size + borderWidth * 2;

  const outerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: outerSize,
    height: outerSize,
    flexShrink: 0,
    clipPath: HEX_CLIP,
    background: borderColor
      ? `color-mix(in srgb, ${borderColor} 45%, transparent)`
      : 'var(--border-line)',
  };

  const innerStyle: React.CSSProperties = {
    width: size,
    height: size,
    clipPath: HEX_CLIP,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: borderColor
      ? `color-mix(in srgb, ${borderColor} 10%, var(--surface-raise))`
      : 'var(--surface-raise)',
  };

  const fontSize = Math.round(size * 0.3);

  return (
    <span style={outerStyle}>
      <span style={innerStyle}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? initials}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize,
              color: borderColor ?? 'var(--text-muted)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
