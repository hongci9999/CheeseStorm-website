import type { CSSProperties } from 'react';

// 계정레벨 캡슐 — 스트리머 카드·상세 프로필 공용.
// 레벨이 오를수록 무채색(회색) → 빨강으로 채도가 짙어지고,
// 1000을 초과하면 화려한 애니메이션 그라데이션(.lvl-legendary)으로 전환.
// 훅을 쓰지 않아 서버 컴포넌트에서도 안전.
const LEGENDARY_THRESHOLD = 1000;

const BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  height: 22, padding: '0 10px', borderRadius: 'var(--r-pill)',
  fontFamily: 'var(--font-numeral)', fontWeight: 800, fontSize: 12,
  letterSpacing: '0.02em', whiteSpace: 'nowrap',
};

// 무지개 그라데이션 — 양 끝을 같은 금색으로 맞춰 이음매 없이 흐르게.
// LEGENDARY_ALPHA(0~100)로 알약 배경 투명도를 한 곳에서 조절. 100=불투명, 낮을수록 투명.
const LEGENDARY_ALPHA = 80;
const LEGENDARY_COLORS = ['#ffd700', '#ff7a59', '#ff4db8', '#c850ff', '#4d9bff', '#38e8c8', '#ffd700'];
const LEGENDARY_GRADIENT = `linear-gradient(90deg, ${LEGENDARY_COLORS
  .map((c) => `color-mix(in srgb, ${c} ${LEGENDARY_ALPHA}%, transparent)`)
  .join(', ')})`;

export function LevelBadge({ level, style }: { level: number; style?: CSSProperties }) {
  // 1000 초과: 화려한 무지개 캡슐. 배경·색은 인라인으로 항상 그려지고(클래스 미적용 환경에서도 OK),
  // 흐르는 애니메이션만 .lvl-legendary 클래스가 담당.
  if (level > LEGENDARY_THRESHOLD) {
    return (
      <span
        className="lvl-legendary"
        style={{
          ...BASE,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          background: LEGENDARY_GRADIENT,
          backgroundSize: '200% 100%',
          boxShadow:
            '0 0 10px color-mix(in srgb, #ff6bd6 50%, transparent), inset 0 0 0 1px rgba(255,255,255,0.28)',
          ...style,
        }}
      >
        Lv.{level}
      </span>
    );
  }

  // 0~1000: 티어표처럼 무채색 → 여러 색 → 빨강으로 스윕.
  // 색조는 보라(240)에서 시작해 파랑·청록·초록·노랑·주황을 지나 빨강(0)으로,
  // 채도는 0%(회색)에서 80%로 끌어올려 낮은 레벨은 무채색에 가깝게.
  const t = Math.max(0, Math.min(level / LEGENDARY_THRESHOLD, 1));
  const hue = Math.round(240 * (1 - t));
  const sat = Math.round(Math.min(t * 1.3, 1) * 80);
  const color = `hsl(${hue}, ${sat}%, 56%)`;
  return (
    <span style={{
      ...BASE,
      color,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
      ...style,
    }}>
      Lv.{level}
    </span>
  );
}
