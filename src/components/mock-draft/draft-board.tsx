'use client';

import { useEffect, useState } from 'react';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
} from '@/lib/draft/engine';
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

  const done = isComplete(state);

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

  // 픽 스텝에 진입하면 첫 미배정 플레이어를 자동 선택 → 바로 영웅 클릭 가능.
  // (스텝이 바뀔 때마다 cursor 기준으로 재설정하므로 스테일 선택도 정리됨)
  useEffect(() => {
    if (step?.kind === 'pick') setSelectedPlayer(pickTeamPlayers[0]?.id ?? '');
    else setSelectedPlayer('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cursor]);

  // 현재 스텝의 선택 가능 영웅. 픽 스텝이면 선택된 플레이어 기준(소프트 피어리스).
  const available = step
    ? availableHeroes(series, state, step.kind === 'pick' ? validPlayer || undefined : undefined)
    : [];

  function handlePick(hero: string) {
    if (!step) return;
    if (step.kind === 'ban') {
      onApply(applyBan(state, hero));
    } else {
      if (!validPlayer) return;           // 플레이어 미선택(또는 스테일 선택) 시 무시
      onApply(applyPick(state, hero, validPlayer));
      setSelectedPlayer('');
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px', gap: 12 }}>
      <TeamColumn team="blue" series={series} state={state} />

      <div style={{ display: 'grid', gap: 8 }}>
        {!done && step && (
          <div style={{ textAlign: 'center', fontWeight: 700 }}>
            <span style={{ color: step.team === 'blue' ? '#3b82f6' : '#ef4444' }}>
              {step.team === 'blue' ? '블루' : '레드'}
            </span>{' '}
            {step.kind === 'ban' ? '밴' : '픽'} 차례
          </div>
        )}

        {!done && step?.kind === 'pick' && (
          <select value={validPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
            <option value="">플레이어 선택</option>
            {pickTeamPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {!done && <HeroGrid available={available} onPick={handlePick} />}

        {done && (
          <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
            <strong>드래프트 완료 — 승자 선택</strong>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => onFinish('blue')} style={{ color: '#3b82f6' }}>블루 승</button>
              <button onClick={() => onFinish('red')} style={{ color: '#ef4444' }}>레드 승</button>
            </div>
          </div>
        )}

        <button onClick={onUndo} disabled={state.cursor === 0} style={{ justifySelf: 'center' }}>되돌리기</button>
      </div>

      <TeamColumn team="red" series={series} state={state} />
    </div>
  );
}

// 팀 픽/밴 슬롯 표시.
function TeamColumn({ team, series, state }: { team: Team; series: Series; state: DraftState }) {
  const players = team === 'blue' ? series.blue : series.red;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  return (
    <div style={{ border: '1px solid #8884', borderRadius: 8, padding: 8, display: 'grid', gap: 6 }}>
      <strong style={{ color: team === 'blue' ? '#3b82f6' : '#ef4444' }}>
        {team === 'blue' ? '블루' : '레드'}
      </strong>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>픽</div>
        {state.picks[team].map(([pid, hero], i) => (
          <div key={i} style={{ fontSize: 13 }}>{nameOf(pid)} — {hero}</div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>밴</div>
        <div style={{ fontSize: 13 }}>{state.bans[team].join(', ')}</div>
      </div>
    </div>
  );
}
