'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
} from '@/lib/draft/engine';
import { mapImageUrl } from '@/lib/draft/map-image';
import { heroImageUrl } from '@/lib/hero-image';
import { card, primaryBtn, secondaryBtn, field, teamColor } from './ui';
import type { Series, DraftState, Team, Player } from '@/lib/draft/types';

interface Props {
  series: Series;
  state: DraftState;
  onApply: (next: DraftState) => void;
  onUndo: () => void;
  onFinish: (winner: Team) => void;
}

// 팀의 이미 픽에 배정된 플레이어 id 집합.
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

  // 현재 픽 스텝 팀의 미배정 플레이어 목록.
  const pickTeamPlayers: Player[] = step?.kind === 'pick'
    ? (step.team === 'blue' ? series.blue : series.red).filter(
        (p) => !assignedIds(state, step.team).has(p.id),
      )
    : [];

  // 현재 픽 스텝의 미배정 플레이어 목록에 실제로 존재할 때만 유효한 선택으로 간주.
  // (undo 등으로 스텝이 바뀌어 이전 팀의 선택이 남아있는 경우를 방어)
  const validPlayer =
    step?.kind === 'pick' && pickTeamPlayers.some((p) => p.id === selectedPlayer)
      ? selectedPlayer
      : '';

  // 자동 배정 모드(스트리머 선택 없이 빠른 시작): 픽을 첫 미배정 플레이어에 자동 배정.
  const autoAssign = series.autoAssign === true;

  // 픽 스텝에서 실제 배정 대상 플레이어. 자동 모드면 첫 미배정, 아니면 드롭다운 선택값.
  const pickPlayerId = step?.kind === 'pick'
    ? (autoAssign ? (pickTeamPlayers[0]?.id ?? '') : validPlayer)
    : '';

  // 현재 스텝의 선택 가능 영웅. 픽 스텝이면 배정 대상 플레이어 기준(소프트 피어리스).
  const available = step
    ? availableHeroes(series, state, step.kind === 'pick' ? pickPlayerId || undefined : undefined)
    : [];

  // 선택된 영웅이 여전히 유효한지(잠기지 않았는지).
  const heroReady = selectedHero !== '' && available.includes(selectedHero);
  // 확정 가능 여부: 밴은 영웅만, 픽은 영웅 + 배정 대상 플레이어 필요.
  const canConfirm = !done && !!step && heroReady && (step.kind === 'ban' || !!pickPlayerId);

  // 확정 버튼 → 현재 스텝에 선택 영웅 적용.
  function handleConfirm() {
    if (!step || !heroReady) return;
    if (step.kind === 'ban') {
      onApply(applyBan(state, selectedHero));
    } else {
      if (!pickPlayerId) return;
      onApply(applyPick(state, selectedHero, pickPlayerId));
    }
    // 상태 초기화는 cursor 변경 useEffect가 처리.
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', gap: 'var(--sp-3)', alignItems: 'start' }}>
      <TeamColumn team="blue" series={series} state={state} />

      <div style={{ ...card, display: 'grid', gap: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', justifyContent: 'center' }}>
          {mapImageUrl(state.map) && (
            <Image src={mapImageUrl(state.map)!} alt={state.map} width={64} height={36}
              style={{ borderRadius: 'var(--r-sm)', objectFit: 'cover', width: 64, height: 'auto' }} />
          )}
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{state.map}</span>
        </div>

        {!done && step && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)' }}>
            <span style={{ color: teamColor(step.team) }}>
              {step.team === 'blue' ? '블루' : '레드'}
            </span>{' '}
            <span style={{ color: 'var(--text-high)' }}>{step.kind === 'ban' ? '밴' : '픽'} 차례</span>
          </div>
        )}

        {!done && step?.kind === 'pick' && !autoAssign && (
          <select style={{ ...field, justifySelf: 'center', minWidth: 200 }} value={validPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
            <option value="">플레이어 선택</option>
            {pickTeamPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {!done && step?.kind === 'pick' && autoAssign && pickTeamPlayers[0] && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            자동 배정 → <span style={{ color: teamColor(step.team), fontWeight: 700 }}>{pickTeamPlayers[0].name}</span>
          </div>
        )}

        {!done && <HeroGrid available={available} selected={selectedHero} onSelect={setSelectedHero} />}

        {!done && step && (
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ ...primaryBtn, justifySelf: 'center', minWidth: 180,
              opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
          >
            {step.kind === 'ban' ? '영웅 금지' : '영웅 선택'}
            {heroReady ? ` — ${selectedHero}` : ''}
          </button>
        )}

        {done && (
          <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--sp-2)' }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)', color: 'var(--text-high)' }}>드래프트 완료 — 승자 선택</strong>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
              <button onClick={() => onFinish('blue')} style={{ ...secondaryBtn, color: teamColor('blue'), borderColor: `color-mix(in srgb, ${teamColor('blue')} 45%, var(--border-line))` }}>블루 승</button>
              <button onClick={() => onFinish('red')} style={{ ...secondaryBtn, color: teamColor('red'), borderColor: `color-mix(in srgb, ${teamColor('red')} 45%, var(--border-line))` }}>레드 승</button>
            </div>
          </div>
        )}

        <button onClick={onUndo} disabled={state.cursor === 0}
          style={{ ...secondaryBtn, justifySelf: 'center', opacity: state.cursor === 0 ? 0.4 : 1,
            cursor: state.cursor === 0 ? 'not-allowed' : 'pointer' }}>되돌리기</button>
      </div>

      <TeamColumn team="red" series={series} state={state} />
    </div>
  );
}

// 팀 픽/밴 슬롯 표시.
function TeamColumn({ team, series, state }: { team: Team; series: Series; state: DraftState }) {
  const players = team === 'blue' ? series.blue : series.red;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const accent = teamColor(team);
  return (
    <div style={{ ...card, borderColor: `color-mix(in srgb, ${accent} 35%, var(--border-line))`, display: 'grid', gap: 'var(--sp-3)' }}>
      <strong style={{ color: accent, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: 'var(--ls-wide)' }}>
        {team === 'blue' ? '블루' : '레드'}
      </strong>

      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>픽</div>
        {state.picks[team].map(([pid, hero], i) => {
          const img = heroImageUrl(hero);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {img && <Image src={img} alt={hero} width={24} height={24}
                style={{ borderRadius: 'var(--r-xs)', width: 24, height: 'auto', boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)` }} />}
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-body)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>{nameOf(pid)}</span> · {hero}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>밴</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {state.bans[team].map((hero, i) => {
            const img = heroImageUrl(hero);
            return img
              ? <Image key={i} src={img} alt={hero} title={hero} width={22} height={22}
                  style={{ borderRadius: 'var(--r-xs)', width: 22, height: 'auto', filter: 'grayscale(1)', opacity: 0.55 }} />
              : <span key={i} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{hero}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
