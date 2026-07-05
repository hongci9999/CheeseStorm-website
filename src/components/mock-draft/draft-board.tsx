'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
} from '@/lib/draft/engine';
import { mapImageUrl } from '@/lib/draft/map-image';
import { heroImageUrl } from '@/lib/hero-image';
import { HexAvatar } from '@/components/hexagon-avatar';
import { primaryBtn, secondaryBtn, field, teamColor } from './ui';
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
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center', paddingBottom: 80 }}>
      {/* 맵 */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
        {mapImageUrl(state.map) && (
          <Image src={mapImageUrl(state.map)!} alt={state.map} width={64} height={36}
            style={{ borderRadius: 'var(--r-sm)', objectFit: 'cover', width: 64, height: 'auto' }} />
        )}
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{state.map}</span>
      </div>

      {/* 턴 알약 */}
      {!done && step && (
        <div style={{ padding: '8px 22px', borderRadius: 'var(--r-pill)',
          border: `1px solid ${teamColor(step.team)}`,
          background: `color-mix(in srgb, ${teamColor(step.team)} 16%, transparent)`,
          color: teamColor(step.team), fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)' }}>
          {step.team === 'blue' ? '블루' : '레드'} {step.kind === 'ban' ? '밴' : '픽'} 차례
        </div>
      )}

      {/* 픽 배정 대상 */}
      {!done && step?.kind === 'pick' && !autoAssign && (
        <select style={{ ...field, minWidth: 220 }} value={validPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
          <option value="">플레이어 선택</option>
          {pickTeamPlayers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      )}
      {!done && step?.kind === 'pick' && autoAssign && pickTeamPlayers[0] && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          자동 배정 → <span style={{ color: teamColor(step.team), fontWeight: 700 }}>{pickTeamPlayers[0].name}</span>
        </div>
      )}

      {/* 팀 육각 컬럼 좌/우, 중앙 영웅 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr 190px', gap: 'var(--sp-5)', alignItems: 'start', width: '100%' }}>
        <TeamColumn team="blue" series={series} state={state} align="end" />

        <div style={{ display: 'grid', gap: 'var(--sp-3)', justifyItems: 'center' }}>
          {!done && <HeroGrid available={available} selected={selectedHero} onSelect={setSelectedHero} />}
          {done && (
            <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-6) 0' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', color: 'var(--text-high)' }}>드래프트 완료 — 승자 선택</strong>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
                <button onClick={() => onFinish('blue')} style={{ ...secondaryBtn, color: teamColor('blue'), borderColor: `color-mix(in srgb, ${teamColor('blue')} 45%, var(--border-line))` }}>블루 승</button>
                <button onClick={() => onFinish('red')} style={{ ...secondaryBtn, color: teamColor('red'), borderColor: `color-mix(in srgb, ${teamColor('red')} 45%, var(--border-line))` }}>레드 승</button>
              </div>
            </div>
          )}
        </div>

        <TeamColumn team="red" series={series} state={state} align="start" />
      </div>

      {/* sticky 액션바 */}
      <div style={{ position: 'sticky', bottom: 0, width: '100%', display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center',
        padding: 'var(--sp-4) 0 var(--sp-3)', background: 'linear-gradient(transparent, var(--bg-app) 40%)' }}>
        <button onClick={onUndo} disabled={state.cursor === 0}
          style={{ ...secondaryBtn, opacity: state.cursor === 0 ? 0.4 : 1, cursor: state.cursor === 0 ? 'not-allowed' : 'pointer' }}>되돌리기</button>
        {!done && step && (
          <button onClick={handleConfirm} disabled={!canConfirm}
            style={{ ...primaryBtn, minWidth: 200, opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
            {step.kind === 'ban' ? '영웅 금지' : '영웅 선택'}{heroReady ? ` — ${selectedHero}` : ''}
          </button>
        )}
      </div>
    </div>
  );
}

// 팀 픽/밴 컬럼 — 5명 육각 아바타(배정 영웅 표시) + 밴 목록.
function TeamColumn({ team, series, state, align }: { team: Team; series: Series; state: DraftState; align: 'start' | 'end' }) {
  const players = team === 'blue' ? series.blue : series.red;
  const accent = teamColor(team);
  const rowDir = align === 'end' ? 'row-reverse' : 'row';
  const pickOf = (id: string) => state.picks[team].find(([pid]) => pid === id)?.[1];
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)', justifyItems: align === 'end' ? 'end' : 'start' }}>
      <strong style={{ color: accent, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)', letterSpacing: 'var(--ls-wide)' }}>
        {team === 'blue' ? '블루' : '레드'}
      </strong>

      {players.map((p) => {
        const hero = pickOf(p.id);
        return (
          <div key={p.id} style={{ display: 'flex', flexDirection: rowDir, alignItems: 'center', gap: 8, opacity: hero ? 1 : 0.55 }}>
            <HexAvatar name={p.name} imageUrl={hero ? heroImageUrl(hero) ?? p.imageUrl : p.imageUrl} ring={accent} size={44} />
            <span style={{ display: 'grid', textAlign: align === 'end' ? 'right' : 'left' }}>
              <b style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-high)' }}>{p.name}</b>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: hero ? accent : 'var(--text-faint)' }}>{hero ?? '대기'}</span>
            </span>
          </div>
        );
      })}

      <div style={{ display: 'grid', gap: 4, justifyItems: align === 'end' ? 'end' : 'start' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-faint)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>밴</div>
        <div style={{ display: 'flex', flexDirection: rowDir, gap: 4, flexWrap: 'wrap' }}>
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
