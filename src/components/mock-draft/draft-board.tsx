'use client';

import { useEffect, useMemo, useState } from 'react';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
  heroesPickedInSeries, heroesPlayedBy,
} from '@/lib/draft/engine';
import { heroImageUrl } from '@/lib/hero-image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { primaryBtn, secondaryBtn, field, teamColor, teamLabel } from './ui';
import type { Series, DraftState, Team, Player } from '@/lib/draft/types';

interface Props {
  series: Series;
  state: DraftState;
  onApply: (next: DraftState) => void;
  onUndo: () => void;
  onFinish: (winner: Team) => void;
}

const BANS_PER_TEAM = 3; // 시퀀스상 팀당 밴 3회

function assignedIds(state: DraftState, team: Team): Set<string> {
  return new Set(state.picks[team].map(([pid]) => pid));
}

export function DraftBoard({ series, state, onApply, onUndo, onFinish }: Props) {
  const step = currentStep(state);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedHero, setSelectedHero] = useState<string>('');

  const done = isComplete(state);

  // 스텝이 바뀌면(적용/되돌리기) 임시 선택 초기화.
  useEffect(() => {
    setSelectedHero('');
    setSelectedPlayer('');
  }, [state.cursor]);

  const pickTeamPlayers: Player[] = step?.kind === 'pick'
    ? (step.team === 'blue' ? series.blue : series.red).filter(
        (p) => !assignedIds(state, step.team).has(p.id),
      )
    : [];

  const validPlayer =
    step?.kind === 'pick' && pickTeamPlayers.some((p) => p.id === selectedPlayer)
      ? selectedPlayer
      : '';

  const autoAssign = series.autoAssign === true;

  const pickPlayerId = step?.kind === 'pick'
    ? (autoAssign ? (pickTeamPlayers[0]?.id ?? '') : validPlayer)
    : '';

  const available = step
    ? availableHeroes(series, state, step.kind === 'pick' ? pickPlayerId || undefined : undefined)
    : [];

  const heroReady = selectedHero !== '' && available.includes(selectedHero);
  const canConfirm = !done && !!step && heroReady && (step.kind === 'ban' || !!pickPlayerId);

  // 수동 픽 스텝의 배정 대상 팀 — 이 팀 미배정 스트리머 육각이 클릭 가능.
  const pickTeam = !done && step?.kind === 'pick' && !autoAssign ? step.team : null;

  // 영웅 선택 카드 배경 — 현재 차례 사이드로 그라데이션(상단바와 동일 전환).
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
    else {
      if (!pickPlayerId) return;
      onApply(applyPick(state, selectedHero, pickPlayerId));
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)', justifyItems: 'center', paddingBottom: 88 }}>
      {/* ── 상단바 아래: 양팀 밴 스트립 (가운데=하드 피어리스 사용됨) ── */}
      <BanStrip series={series} state={state} hardUsed={hardUsed} />

      {/* ── 본문 3열: 블루 허니콤 | 중앙 영웅풀 카드 | 레드 허니콤 (셋업과 동일 구성) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', justifyContent: 'center',
        gap: 'var(--sp-10)', alignItems: 'start' }}>
        <TeamPanel team="blue" series={series} state={state}
          activePickTeam={pickTeam} selectedPlayer={validPlayer} onSelectPlayer={setSelectedPlayer} />

        {/* 중앙 패널 — 셋업 중앙 카드와 동일한 테두리 카드 */}
        <div style={{ width: 600, border: '2px solid var(--border-strong)', borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)', background: cardBg, display: 'grid', gap: 'var(--sp-3)', alignContent: 'start',
          transition: 'background var(--dur-fast) var(--ease-out)' }}>
          {!done && <HeroGrid available={available} selected={selectedHero} onSelect={setSelectedHero} />}
          {done && (
            <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-6) 0' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', color: 'var(--text-high)' }}>드래프트 완료 — 승자 선택</strong>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
                <button onClick={() => onFinish('blue')} style={{ ...secondaryBtn, color: teamColor('blue'), borderColor: `color-mix(in srgb, ${teamColor('blue')} 45%, var(--border-line))` }}>{teamLabel(series, 'blue')} 승</button>
                <button onClick={() => onFinish('red')} style={{ ...secondaryBtn, color: teamColor('red'), borderColor: `color-mix(in srgb, ${teamColor('red')} 45%, var(--border-line))` }}>{teamLabel(series, 'red')} 승</button>
              </div>
            </div>
          )}
        </div>

        <TeamPanel team="red" series={series} state={state} mirror
          activePickTeam={pickTeam} selectedPlayer={validPlayer} onSelectPlayer={setSelectedPlayer} />
      </div>

      {/* ── 하단 액션바: 스트리머 선택 → 영웅 선택 → 확인 / 되돌리기 ── */}
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', width: '100%', padding: 'var(--sp-4) 0 var(--sp-3)', background: 'linear-gradient(transparent, var(--bg-app) 40%)' }}>
        <button onClick={onUndo} disabled={state.cursor === 0}
          style={{ ...secondaryBtn, opacity: state.cursor === 0 ? 0.4 : 1, cursor: state.cursor === 0 ? 'not-allowed' : 'pointer' }}>되돌리기</button>

        {!done && step?.kind === 'pick' && !autoAssign && (
          <select style={{ ...field, minWidth: 180 }} value={validPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
            <option value="">스트리머 선택</option>
            {pickTeamPlayers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        )}
        {!done && step?.kind === 'pick' && autoAssign && pickTeamPlayers[0] && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            자동 배정 → <b style={{ color: teamColor(step.team) }}>{pickTeamPlayers[0].name}</b>
          </span>
        )}

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

// 팀 허니콤 패널 — 셋업 TeamPanel과 동일 지그재그 배치. 픽되면 육각을 영웅 사진으로 교체 + 이름 라벨.
function TeamPanel({ team, series, state, mirror = false, activePickTeam = null, selectedPlayer = '', onSelectPlayer }: {
  team: Team; series: Series; state: DraftState; mirror?: boolean;
  activePickTeam?: Team | null; selectedPlayer?: string; onSelectPlayer?: (id: string) => void;
}) {
  const players = team === 'blue' ? series.blue : series.red;
  const c = teamColor(team);
  const soft = series.draftType === 'soft';
  const pickOf = (id: string) => state.picks[team].find(([pid]) => pid === id)?.[1];
  const assigned = assignedIds(state, team); // 이미 픽 배정된 플레이어
  // 셋업 TeamPanel과 동일한 브릭 오프셋 지오메트리.
  const S = 104;
  const gap = 12;
  const stepX = Math.round(S * 0.866 + gap);
  const rowMt = Math.round(-S * 0.25 + gap * 0.866);
  const oddOffset = Math.round(stepX / 2);
  return (
    <div style={{ width: S + oddOffset, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {players.map((p, i) => {
        const hero = pickOf(p.id);
        // 소프트 피어리스: 이 스트리머가 이전 세트에서 쓴(잠긴) 영웅 — 바깥쪽 마젠타 칩.
        const used = soft ? [...heroesPlayedBy(series.sets, p.id)] : [];
        // 이 팀 픽 차례 + 미배정 스트리머면 육각 클릭으로 배정 대상 선택 가능.
        const selectable = activePickTeam === team && !assigned.has(p.id);
        const isSelected = selectable && selectedPlayer === p.id;
        return (
          <div key={p.id}
            onClick={selectable ? () => onSelectPlayer?.(p.id) : undefined}
            title={selectable ? `${p.name}로 픽` : undefined}
            style={{ position: 'relative', flex: '0 0 auto', width: S, height: S,
              marginTop: i === 0 ? 0 : rowMt, marginLeft: (mirror ? i % 2 === 0 : i % 2 === 1) ? oddOffset : 0,
              lineHeight: 0, cursor: selectable ? 'pointer' : 'default',
              transform: isSelected ? 'scale(1.08)' : undefined, zIndex: isSelected ? 5 : undefined,
              filter: isSelected ? `drop-shadow(0 0 7px ${c})` : undefined,
              transition: 'transform var(--dur-fast) var(--ease-out)' }}>
            {used.length > 0 && (
              <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 4,
                display: 'flex', flexDirection: mirror ? 'row' : 'row-reverse', gap: 3,
                ...(mirror ? { left: '100%', marginLeft: 6 } : { right: '100%', marginRight: 6 }) }}>
                {used.map((h) => <HeroHex key={h} hero={h} size={44} tone="soft" />)}
              </span>
            )}
            <HexAvatar name={p.name} imageUrl={hero ? heroImageUrl(hero) ?? p.imageUrl : p.imageUrl} ring={c} size={S}>
              {/* 대기(픽 전) 슬롯만 안쪽 이미지 흐림 — 선택된 슬롯은 밝게. 스크림은 내부 육각에만 클립돼 테두리(ring) 안 건드림 */}
              {!hero && !isSelected && <span aria-hidden style={{ position: 'absolute', inset: 0,
                background: 'color-mix(in srgb, var(--bg-void) 62%, transparent)' }} />}
              {/* 이름 라벨(스트리머) — 하단 오버레이 */}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 4px 10px', textAlign: 'center',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-3xs)', fontWeight: 700, color: '#fff', lineHeight: 1.1,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.82))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            </HexAvatar>
            {/* 팀장 완장 */}
            {i === 0 && (
              <span title="팀장" style={{ position: 'absolute', top: -2, right: 4, zIndex: 3,
                width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center',
                background: c, color: 'var(--bg-void)', fontSize: 14, lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>👑</span>
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
