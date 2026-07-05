'use client';

import { useEffect, useState } from 'react';
import { getStreamers } from '@/lib/firestore';
import type { Streamer } from '@/lib/types';
import type { Series, Player, DraftType } from '@/lib/draft/types';

const DRAFT_LABELS: Record<DraftType, string> = {
  normal: '일반',
  soft: '소프트 피어리스',
  hard: '하드 피어리스',
};

// 스트리머 → Player 변환.
function toPlayer(s: Streamer): Player {
  return { id: s.id, name: s.name, imageUrl: s.profileImageUrl };
}

interface Props {
  onStart: (series: Series) => void;
}

export function SeriesSetup({ onStart }: Props) {
  const [draftType, setDraftType] = useState<DraftType>('normal');
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [blue, setBlue] = useState<Player[]>([]);
  const [red, setRed] = useState<Player[]>([]);
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    getStreamers().then(setStreamers).catch(() => setStreamers([]));
  }, []);

  const inRoster = (id: string) =>
    blue.some((p) => p.id === id) || red.some((p) => p.id === id);

  // 팀에 플레이어 추가(5명 초과 방지, 중복 방지).
  function addTo(team: 'blue' | 'red', player: Player) {
    const list = team === 'blue' ? blue : red;
    const setList = team === 'blue' ? setBlue : setRed;
    if (list.length >= 5 || inRoster(player.id)) return;
    setList([...list, player]);
  }

  function removeFrom(team: 'blue' | 'red', id: string) {
    const setList = team === 'blue' ? setBlue : setRed;
    const list = team === 'blue' ? blue : red;
    setList(list.filter((p) => p.id !== id));
  }

  function addManual(team: 'blue' | 'red') {
    const name = manualName.trim();
    if (!name) return;
    addTo(team, { id: `manual:${crypto.randomUUID()}`, name });
    setManualName('');
  }

  const canStart = blue.length === 5 && red.length === 5;

  function handleStart() {
    if (!canStart) return;
    onStart({ draftType, bestOf, blue, red, sets: [], current: null });
  }

  const available = streamers.filter((s) => !inRoster(s.id));

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>모의 밴픽 — 시리즈 설정</h1>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>드래프트 종류:{' '}
          <select value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)}>
            {(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => (
              <option key={k} value={k}>{DRAFT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label>방식:{' '}
          <select value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as 3 | 5)}>
            <option value={3}>Bo3</option>
            <option value={5}>Bo5</option>
          </select>
        </label>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['blue', 'red'] as const).map((team) => {
          const list = team === 'blue' ? blue : red;
          return (
            <div key={team} style={{ border: '1px solid #8884', borderRadius: 8, padding: 8 }}>
              <strong style={{ color: team === 'blue' ? '#3b82f6' : '#ef4444' }}>
                {team === 'blue' ? '블루 팀' : '레드 팀'} ({list.length}/5)
              </strong>
              <ul style={{ margin: '8px 0', display: 'grid', gap: 4 }}>
                {list.map((p) => (
                  <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.name}</span>
                    <button onClick={() => removeFrom(team, p.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section>
        <strong>스트리머 목록에서 추가</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {available.map((s) => (
            <span key={s.id} style={{ display: 'inline-flex', gap: 4, border: '1px solid #8884', borderRadius: 6, padding: '2px 6px' }}>
              {s.name}
              <button onClick={() => addTo('blue', toPlayer(s))} style={{ color: '#3b82f6' }}>블루</button>
              <button onClick={() => addTo('red', toPlayer(s))} style={{ color: '#ef4444' }}>레드</button>
            </span>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="수동 이름 입력"
        />
        <button onClick={() => addManual('blue')} style={{ color: '#3b82f6' }}>블루 추가</button>
        <button onClick={() => addManual('red')} style={{ color: '#ef4444' }}>레드 추가</button>
      </section>

      <button
        onClick={handleStart}
        disabled={!canStart}
        style={{ padding: '8px 16px', fontWeight: 700, opacity: canStart ? 1 : 0.5 }}
      >
        {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
      </button>
    </div>
  );
}
