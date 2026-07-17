'use client';

import Image from 'next/image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { heroImageUrl } from '@/lib/hero-image';
import { mapImageUrl } from '@/lib/draft/map-image';
import { scrimTimeline, PHASE_STARTS, type Scrim, type ScrimStep } from '@/lib/scrim';
import type { Team } from '@/lib/draft/types';

// 액션 색 — 목업 규약: 핑크=밴, 블루=픽 (팀 색 아님).
export const BAN_COLOR = '#e93cc8';
export const PICK_COLOR = 'var(--cheese-blue)';

export function scrimDateLabel(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 16스텝 허니콤 좌표 계산.
// 같은 팀 연속 스텝=옆칸(w), 팀 전환=반칸(w/2) 인터록으로 x축이 곧 전역 진행 순서가 된다.
// 페이즈(밴1|픽1|밴2|픽2) 시작 지점엔 추가 간격.
// 행 간 세로 오프셋·스트립 높이 배율 — RowLabels·WinBadge 행 중심 계산과 공유.
const ROW_OFF = 0.9;          // 아랫행(후픽팀) y = S * ROW_OFF
const STRIP_H = 1 + ROW_OFF;  // 스트립 높이 = S * STRIP_H

function layout(timeline: ScrimStep[], S: number) {
  const w = S * 0.866; // 뾰족 육각형(HEX_CLIP) 실폭
  const g = 2;
  const phaseGap = Math.round(S * 0.15); // 밴↔픽 페이즈 사이 간격
  let x = 0;
  const pos = timeline.map((st, i) => {
    if (i > 0) {
      x += (st.team === timeline[i - 1].team ? w : w / 2) + g;
      if (PHASE_STARTS.has(i)) x += phaseGap;
    }
    return { x: Math.round(x), y: st.team === 'blue' ? 0 : Math.round(S * ROW_OFF) };
  });
  return { pos, width: Math.ceil(x + w), height: Math.ceil(S * STRIP_H) };
}

// 밴픽 타임라인 허니콤 스트립 — 기록 카드·입력 미리보기 공용.
// 윗행=선픽팀(blue), 아랫행=후픽팀(red). 빈 슬롯은 액션 색 힌트만 흐리게.
export function ScrimHexStrip({ bans, picks, S = 52, scale = 1, highlight }: {
  bans: Record<Team, string[]>;
  picks: Record<Team, string[]>;
  S?: number;      // 배치 간격 단위 = 초상화 크기(scale 1 기준)
  scale?: number;  // 초상화만 추가 확대 — 1 초과 시 간격 유지한 채 겹침(밀착 연출용)
  highlight?: number; // 입력 중인 전역 스텝 인덱스 — 글로우 강조
}) {
  const timeline = scrimTimeline(bans, picks);
  const { pos, width, height } = layout(timeline, S);
  const hexSize = Math.round(S * scale);
  const off = Math.round((hexSize - S) / 2); // 슬롯 중심 유지용 보정 + 가장자리 여백
  return (
    <div style={{ position: 'relative', width: width + off * 2, height: height + off * 2, flexShrink: 0 }}>
      {timeline.map((st, i) => {
        const color = st.kind === 'ban' ? BAN_COLOR : PICK_COLOR;
        const filled = st.hero !== undefined;
        const active = highlight === i;
        return (
          <span key={i}
            title={filled ? `${i + 1}. ${st.hero} ${st.kind === 'ban' ? '밴' : '픽'}` : undefined}
            style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, lineHeight: 0,
              filter: active ? `drop-shadow(0 0 6px ${color})` : undefined,
              zIndex: active ? 2 : filled ? 1 : 0 }}>
            <HexAvatar name={filled ? st.hero! : ''}
              imageUrl={filled ? heroImageUrl(st.hero!) : undefined}
              ring={filled || active ? color : `color-mix(in srgb, ${color} 32%, transparent)`}
              size={hexSize}
              imgStyle={st.kind === 'ban' ? { filter: 'grayscale(0.85) brightness(0.85)' } : undefined} />
          </span>
        );
      })}
    </div>
  );
}

// 행 라벨 열 — 윗행 선픽 / 아랫행 후픽.
function RowLabels({ S }: { S: number }) {
  const H = Math.ceil(S * STRIP_H);
  const label = (top: number, text: string) => (
    <span key={text} style={{ position: 'absolute', top, transform: 'translateY(-50%)', right: 0,
      fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-3xs)', fontWeight: 700,
      color: 'rgba(255,255,255,0.6)', letterSpacing: 'var(--ls-caps)', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
  return (
    <span style={{ position: 'relative', width: 26, height: H, display: 'inline-block', flexShrink: 0 }}>
      {label(S * 0.5, '선픽')}
      {label(S * (ROW_OFF + 0.5), '후픽')}
    </span>
  );
}

// 승리 팀 행에 붙는 승 배지.
function WinBadge({ S, winner }: { S: number; winner: Team }) {
  const H = Math.ceil(S * STRIP_H);
  const y = winner === 'blue' ? S * 0.5 : S * (ROW_OFF + 0.5);
  return (
    <span style={{ position: 'relative', width: 28, height: H, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: y, transform: 'translateY(-50%)', left: 0,
        display: 'inline-flex', width: 26, height: 26, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--win)', color: 'var(--bg-void)',
        fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 12,
        boxShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>승</span>
    </span>
  );
}

// 스크림 1경기 기록 카드 — 맵 이미지 배경 + 날짜·패치버전·맵 이름·밴픽 스트립·승 표시.
export function ScrimCard({ scrim, S = 52, canEdit = false, onDelete }: {
  scrim: Scrim;
  S?: number;
  canEdit?: boolean;
  onDelete?: () => void;
}) {
  const img = mapImageUrl(scrim.map);
  return (
    <article style={{ position: 'relative', overflow: 'hidden',
      borderRadius: 'var(--r-lg)', border: '1px solid var(--border-line)' }}>
      {img && <Image src={img} alt={scrim.map} fill sizes="760px"
        style={{ objectFit: 'cover', filter: 'brightness(0.7) saturate(0.85)' }} />}
      {/* 텍스트 가독성 그라데이션 */}
      <span aria-hidden style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6))' }} />

      <div style={{ position: 'relative', display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
        {/* 헤더: 날짜 | 패치버전 (+삭제) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontFamily: 'var(--font-numeral)', fontWeight: 700,
            fontSize: 'var(--fs-sm)', color: '#fff', letterSpacing: '0.04em' }}>
            {scrimDateLabel(scrim.date)}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-numeral)',
            fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.75)' }}>
            {scrim.patch ?? ''}
          </span>
          {canEdit && onDelete && (
            <button onClick={onDelete} title="기록 삭제" aria-label="기록 삭제"
              style={{ width: 24, height: 24, borderRadius: 'var(--r-xs)', border: 'none',
                background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.7)',
                fontSize: 12, lineHeight: 1, cursor: 'pointer' }}>✕</button>
          )}
        </div>

        {/* 밴픽 스트립 — 좁은 화면은 가로 스크롤 */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
            width: 'max-content', margin: '0 auto', padding: '2px 0' }}>
            <RowLabels S={S} />
            <ScrimHexStrip bans={scrim.bans} picks={scrim.picks} S={S} />
            <WinBadge S={S} winner={scrim.winner} />
          </div>
        </div>

        {/* 푸터: 맵 이름 */}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-md)', color: '#fff' }}>
          {scrim.map}
        </span>
      </div>
    </article>
  );
}
