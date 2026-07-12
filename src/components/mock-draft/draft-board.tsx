'use client';

import { useEffect, useMemo, useState } from 'react';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
  heroesPickedInSeries, heroesPlayedBy, buildDefaultAssignment, swapAssignment,
} from '@/lib/draft/engine';
import { heroImageUrl } from '@/lib/hero-image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { primaryBtn, secondaryBtn, teamColor, teamLabel } from './ui';
import type { Series, DraftState, Team } from '@/lib/draft/types';

interface Props {
  series: Series;
  state: DraftState;
  onApply: (next: DraftState) => void;
  onUndo: () => void;
  onFinish: (winner: Team) => void;
}

const BANS_PER_TEAM = 3; // 시퀀스상 팀당 밴 3회

export function DraftBoard({ series, state, onApply, onUndo, onFinish }: Props) {
  const step = currentStep(state);
  const done = isComplete(state);
  const [selectedHero, setSelectedHero] = useState<string>('');
  // 픽 교환: 선택된 슬롯(팀+인덱스).
  const [selectedSlot, setSelectedSlot] = useState<{ team: Team; i: number } | null>(null);

  // 스텝이 바뀌면(적용/되돌리기) 임시 선택 초기화.
  useEffect(() => {
    setSelectedHero('');
    setSelectedSlot(null);
  }, [state.cursor]);

  const available = step ? availableHeroes(series, state) : [];
  const heroReady = selectedHero !== '' && available.includes(selectedHero);
  const canConfirm = !done && !!step && heroReady;

  // 완료 시점 영웅 배정 — 스왑 전이면 기본(픽 순서)으로 렌더(첫 스왑 시 state.assignment로 고정됨).
  const assignment = done ? (state.assignment ?? buildDefaultAssignment(state)) : null;

  // 영웅 선택 카드 배경 — 현재 차례 사이드로 그라데이션.
  const cardBg = step?.team === 'blue'
    ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor('blue')} 18%, var(--surface-card)), var(--surface-card) 55%)`
    : step?.team === 'red'
    ? `linear-gradient(270deg, color-mix(in srgb, ${teamColor('red')} 18%, var(--surface-card)), var(--surface-card) 55%)`
    : 'var(--surface-card)';

  // 하드 피어리스: 이전 세트에서 이미 소비된(잠긴) 영웅. 표시용.
  const hardUsed = useMemo(
    () => series.draftType === 'hard' ? [...heroesPickedInSeries(series.sets)] : [],
    [series.draftType, series.sets],
  );

  function handleConfirm() {
    if (!step || !heroReady) return;
    if (step.kind === 'ban') onApply(applyBan(state, selectedHero));
    else onApply(applyPick(state, selectedHero));
  }

  // 선택된 슬롯 기준, 같은 팀의 슬롯 i가 교환 불가(소프트 위반)인가 — 미리 잠금 표시용.
  function slotLocked(team: Team, i: number): boolean {
    if (!selectedSlot || selectedSlot.team !== team || selectedSlot.i === i) return false;
    return swapAssignment(series, state, team, selectedSlot.i, i) === null;
  }

  // 픽 교환 — 같은 팀 두 슬롯 클릭으로 영웅 스왑. 잠긴(위반) 슬롯은 클릭 무시.
  function handleSlotClick(team: Team, i: number) {
    if (!selectedSlot || selectedSlot.team !== team) { setSelectedSlot({ team, i }); return; }
    if (selectedSlot.i === i) { setSelectedSlot(null); return; }
    if (slotLocked(team, i)) return; // 위반 슬롯 — 막힘
    const next = swapAssignment(series, state, team, selectedSlot.i, i);
    if (next) onApply(next);
    setSelectedSlot(null);
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)', justifyItems: 'center', paddingBottom: 88 }}>
      {/* ── 상단바 아래: 양팀 밴 스트립 (가운데=하드 피어리스 사용됨) ── */}
      <BanStrip series={series} state={state} hardUsed={hardUsed} />

      {/* ── 본문 3열: 블루 슬롯 | 중앙 영웅풀/픽교환 카드 | 레드 슬롯 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', justifyContent: 'center',
        gap: 'var(--sp-10)', alignItems: 'start' }}>
        <TeamPanel team="blue" series={series} state={state}
          assignment={assignment} selectedSlot={selectedSlot} onSlotClick={done ? handleSlotClick : undefined} isLocked={slotLocked} />

        {/* 중앙 패널 — 드래프트 중=영웅 그리드, 완료=픽 교환 안내 + 승자 선택 */}
        <div style={{ width: 600, border: '2px solid var(--border-strong)', borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)', background: cardBg, display: 'grid', gap: 'var(--sp-3)', alignContent: 'start',
          transition: 'background var(--dur-fast) var(--ease-out)' }}>
          {!done && <HeroGrid available={available} selected={selectedHero} onSelect={setSelectedHero} />}
          {done && (
            <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-5) 0' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', color: 'var(--text-high)' }}>픽 교환</strong>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                같은 팀 슬롯 두 개를 눌러 누가 어떤 영웅을 플레이할지 교환하세요.
                {series.draftType === 'soft' && <><br />소프트 피어리스에서 이전 세트에 쓴 영웅이 되는 교환은 잠깁니다.</>}
              </span>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center', marginTop: 'var(--sp-2)' }}>
                <button onClick={() => onFinish('blue')} style={{ ...secondaryBtn, color: teamColor('blue'), borderColor: `color-mix(in srgb, ${teamColor('blue')} 45%, var(--border-line))` }}>{teamLabel(series, 'blue')} 승</button>
                <button onClick={() => onFinish('red')} style={{ ...secondaryBtn, color: teamColor('red'), borderColor: `color-mix(in srgb, ${teamColor('red')} 45%, var(--border-line))` }}>{teamLabel(series, 'red')} 승</button>
              </div>
            </div>
          )}
        </div>

        <TeamPanel team="red" series={series} state={state} mirror
          assignment={assignment} selectedSlot={selectedSlot} onSlotClick={done ? handleSlotClick : undefined} isLocked={slotLocked} />
      </div>

      {/* ── 하단 액션바: 영웅 선택 → 확인 / 되돌리기 (드래프트 중만 확인 노출) ── */}
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', width: '100%', padding: 'var(--sp-4) 0 var(--sp-3)', background: 'linear-gradient(transparent, var(--bg-app) 40%)' }}>
        <button onClick={onUndo} disabled={state.cursor === 0}
          style={{ ...secondaryBtn, opacity: state.cursor === 0 ? 0.4 : 1, cursor: state.cursor === 0 ? 'not-allowed' : 'pointer' }}>되돌리기</button>

        {!done && step && (
          <button onClick={handleConfirm} disabled={!canConfirm}
            style={{ ...primaryBtn, minWidth: 200, opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? 'pointer' : 'not-allowed',
              ...(step.kind === 'ban' ? { background: 'var(--loss)', color: '#fff' } : null) }}>
            {step.kind === 'ban' ? '영웅 금지' : '영웅 선택'}{heroReady ? ` — ${selectedHero}` : ''}
          </button>
        )}
      </div>
    </div>
  );
}

// 양팀 밴 스트립 — 상단바 아래. 좌 블루 3칸 / 가운데 하드 피어리스 사용됨 / 우 레드 3칸.
function BanStrip({ series, state, hardUsed }: { series: Series; state: DraftState; hardUsed: string[] }) {
  return (
    <div style={{ width: '100%', maxWidth: 1000, display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center', gap: 'var(--sp-4)' }}>
      <TeamBans team="blue" series={series} bans={state.bans.blue} align="start" />
      {/* 가운데 — 하드 피어리스 사용됨(있을 때만) */}
      {hardUsed.length > 0 ? (
        <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center',
          padding: 'var(--sp-2) var(--sp-3)', border: '1px dashed var(--border-line)', borderRadius: 'var(--r-md)' }}>
          {hardUsed.map((h) => <HeroHex key={h} hero={h} size={28} tone="used" />)}
        </div>
      ) : <span />}
      <TeamBans team="red" series={series} bans={state.bans.red} align="end" />
    </div>
  );
}

function TeamBans({ team, series, bans, align }: { team: Team; series: Series; bans: string[]; align: 'start' | 'end' }) {
  const end = align === 'end';
  return (
    <div style={{ display: 'flex', flexDirection: end ? 'row-reverse' : 'row', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)',
        letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>{teamLabel(series, team)} 밴</span>
      <div style={{ display: 'flex', flexDirection: end ? 'row-reverse' : 'row', gap: 5 }}>
        {Array.from({ length: BANS_PER_TEAM }).map((_, i) => (
          bans[i]
            ? <HeroHex key={i} hero={bans[i]} size={34} tone="ban" />
            : <span key={i} style={{ display: 'inline-flex' }}><HexAvatar name="" ring="var(--border-line)" size={34} /></span>
        ))}
      </div>
    </div>
  );
}

// 팀 슬롯 패널 — 지그재그 5칸. 스트리머 위치는 로스터 순서로 고정(픽 전엔 흐림) + 소프트 피어리스 잠금 칩.
//  드래프트 중: 슬롯 i = 스트리머 i, 픽된 영웅을 위에서부터 슬롯에 채움.
//  픽 교환(assignment 있음): 스트리머 위치 고정, 슬롯 클릭으로 그 스트리머가 플레이할 영웅을 서로 교환.
function TeamPanel({ team, series, state, mirror = false, assignment = null, selectedSlot = null, onSlotClick, isLocked }: {
  team: Team; series: Series; state: DraftState; mirror?: boolean;
  assignment?: Record<Team, string[]> | null;
  selectedSlot?: { team: Team; i: number } | null;
  onSlotClick?: (team: Team, i: number) => void;
  isLocked?: (team: Team, i: number) => boolean; // 선택된 슬롯 기준 교환 불가(소프트 위반) 여부
}) {
  const players = team === 'blue' ? series.blue : series.red;
  const c = teamColor(team);
  const soft = series.draftType === 'soft';
  const exchange = assignment != null;
  // 셋업 TeamPanel과 동일한 브릭 오프셋 지오메트리.
  const S = 104;
  const gap = 12;
  const stepX = Math.round(S * 0.866 + gap);
  const rowMt = Math.round(-S * 0.25 + gap * 0.866);
  const oddOffset = Math.round(stepX / 2);
  return (
    <div style={{ width: S + oddOffset, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        // 스트리머 위치 고정 = 로스터 순서. 영웅만 교환 모드면 배정, 아니면 픽 순서.
        const streamer = players[i];
        const name = streamer?.name ?? '';
        const hero = exchange ? assignment![team][i] : state.picks[team][i];
        // 소프트 피어리스: 이 스트리머가 이전 세트에서 쓴(잠긴) 영웅 — 바깥쪽 마젠타 칩.
        const used = soft && streamer ? [...heroesPlayedBy(series.sets, streamer.id)] : [];
        const selectable = exchange && !!onSlotClick;
        const isSelected = selectable && selectedSlot?.team === team && selectedSlot.i === i;
        // 다른 슬롯이 선택된 상태에서 이 슬롯이 교환 불가면 잠금, 가능하면 후보(강조).
        const locked = selectable && isLocked?.(team, i) === true;
        const candidate = selectable && !!selectedSlot && !isSelected && !locked
          && selectedSlot.team === team;
        const clickable = selectable && !locked;
        const isCaptainSlot = i === 0 && !!streamer;
        return (
          <div key={i}
            onClick={clickable ? () => onSlotClick!(team, i) : undefined}
            title={locked ? `${name} — 이전 세트에 쓴 영웅이라 교환 불가`
              : selectable ? `${name} · ${hero ?? ''} — 눌러서 교환` : undefined}
            style={{ position: 'relative', flex: '0 0 auto', width: S, height: S,
              marginTop: i === 0 ? 0 : rowMt, marginLeft: (mirror ? i % 2 === 0 : i % 2 === 1) ? oddOffset : 0,
              lineHeight: 0, cursor: !selectable ? 'default' : locked ? 'not-allowed' : 'pointer',
              opacity: locked ? 0.4 : 1,
              transform: isSelected ? 'scale(1.08)' : undefined, zIndex: isSelected ? 5 : undefined,
              filter: isSelected ? `drop-shadow(0 0 7px ${c})`
                : candidate ? 'drop-shadow(0 0 5px var(--cheese-green))' : undefined,
              transition: 'transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)' }}>
            {used.length > 0 && (
              <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 4,
                display: 'flex', flexDirection: mirror ? 'row' : 'row-reverse', gap: 3,
                ...(mirror ? { left: '100%', marginLeft: 6 } : { right: '100%', marginRight: 6 }) }}>
                {used.map((h) => <HeroHex key={h} hero={h} size={44} tone="soft" />)}
              </span>
            )}
            <HexAvatar name={name} imageUrl={hero ? heroImageUrl(hero) ?? streamer?.imageUrl : streamer?.imageUrl} ring={c} size={S}>
              {/* 대기(픽 전) 슬롯만 안쪽 흐림 — 선택된 슬롯은 밝게. 스트리머 얼굴이 흐리게 보임 */}
              {!hero && !isSelected && <span aria-hidden style={{ position: 'absolute', inset: 0,
                background: 'color-mix(in srgb, var(--bg-void) 62%, transparent)' }} />}
              {/* 이름 라벨(스트리머) — 하단 오버레이 */}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 4px 10px', textAlign: 'center',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-3xs)', fontWeight: 700, color: '#fff', lineHeight: 1.1,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.82))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            </HexAvatar>
            {/* 팀장 완장 — 팀장 스트리머가 배정된 슬롯에 표시 */}
            {isCaptainSlot && (
              <span title="팀장" style={{ position: 'absolute', top: -2, right: 4, zIndex: 3,
                width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center',
                background: c, color: 'var(--bg-void)', fontSize: 14, lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>👑</span>
            )}
            {/* 교환 불가 잠금 — 중앙 자물쇠 */}
            {locked && (
              <span aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
                fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>🔒</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 영웅 육각 칩 — 밴/기사용/소프트잠금 표시. 톤별 테두리색.
function HeroHex({ hero, size, tone }: { hero: string; size: number; tone: 'ban' | 'used' | 'soft' }) {
  const ring = tone === 'ban' ? 'var(--loss)' : tone === 'soft' ? 'var(--hots-purple)' : 'var(--text-faint)';
  return <span title={hero} style={{ display: 'inline-flex' }}>
    <HexAvatar name={hero} imageUrl={heroImageUrl(hero)} ring={ring} size={size} />
  </span>;
}
