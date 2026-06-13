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

// 구간별 이산 색상 테이블 — min 이상이면 해당 색상 적용, 마지막 매칭값 사용.
// 0~100: 50 단위 컬러(2단계), 100~600: 100 단위, 600~1000: 200 단위.
const LEVEL_STOPS: { min: number; color: string }[] = [
  { min: 0,   color: 'hsl(220, 25%, 55%)' }, // 슬레이트 블루
  { min: 50,  color: 'hsl(190, 55%, 52%)' }, // 청록
  { min: 100, color: 'hsl(48, 75%, 55%)' },  // 노랑
  { min: 200, color: 'hsl(210, 72%, 62%)' }, // 파랑
  { min: 300, color: 'hsl(130, 55%, 50%)' }, // 초록
  { min: 400, color: 'hsl(270, 65%, 65%)' }, // 보라
  { min: 500, color: 'hsl(320, 68%, 62%)' }, // 핑크
  { min: 600, color: 'hsl(25, 82%, 58%)' },  // 주황
  { min: 800, color: 'hsl(5, 82%, 58%)' },   // 빨강
];

function levelColor(level: number): string {
  let color = LEVEL_STOPS[0].color;
  for (const stop of LEVEL_STOPS) {
    if (level >= stop.min) color = stop.color;
    else break;
  }
  return color;
}

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

  // 0~1000: 구간별 이산 색상.
  // 0~100은 20 단위 무채색, 100~600은 100 단위 컬러, 600~1000은 200 단위 붉은 계열.
  const color = levelColor(level);
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
