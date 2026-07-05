'use client';

import { useEffect, useState } from 'react';
import { getStreamers } from '@/lib/firestore';
import type { Streamer } from '@/lib/types';
import type { Series, Player, DraftType } from '@/lib/draft/types';
import { card, primaryBtn, secondaryBtn, field, sectionTitle, pageTitle, teamColor } from './ui';

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

  // 스트리머 지정 없이 기본 플레이어(블루 1~5 / 레드 1~5)로 바로 시작.
  function handleQuickStart() {
    const fill = (team: 'blue' | 'red'): Player[] =>
      Array.from({ length: 5 }, (_, i) => ({
        id: `auto:${team}:${i + 1}`,
        name: `${team === 'blue' ? '블루' : '레드'} ${i + 1}`,
      }));
    onStart({ draftType, bestOf, blue: fill('blue'), red: fill('red'), sets: [], current: null, autoAssign: true });
  }

  const available = streamers.filter((s) => !inRoster(s.id));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={pageTitle}>모의 밴픽 — 시리즈 설정</h1>

      <section style={{ ...card, display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          드래프트 종류
          <select style={field} value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)}>
            {(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => (
              <option key={k} value={k}>{DRAFT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          방식
          <select style={field} value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as 3 | 5)}>
            <option value={3}>Bo3</option>
            <option value={5}>Bo5</option>
          </select>
        </label>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
        {(['blue', 'red'] as const).map((team) => {
          const list = team === 'blue' ? blue : red;
          return (
            <div key={team} style={{ ...card, borderColor: `color-mix(in srgb, ${teamColor(team)} 35%, var(--border-line))` }}>
              <strong style={{ color: teamColor(team), fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: 'var(--ls-wide)' }}>
                {team === 'blue' ? '블루 팀' : '레드 팀'}{' '}
                <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>({list.length}/5)</span>
              </strong>
              <ul style={{ margin: 'var(--sp-2) 0 0', display: 'grid', gap: 4, listStyle: 'none', padding: 0 }}>
                {list.map((p) => (
                  <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
                    <span>{p.name}</span>
                    <button onClick={() => removeFrom(team, p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section style={card}>
        <strong style={sectionTitle}>스트리머 목록에서 추가</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--sp-3)' }}>
          {available.map((s) => (
            <span key={s.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center',
              border: '1px solid var(--border-line)', borderRadius: 'var(--r-pill)', padding: '3px 8px 3px 10px',
              background: 'var(--surface-input)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
              {s.name}
              <button onClick={() => addTo('blue', toPlayer(s))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-xs)', color: teamColor('blue') }}>블루</button>
              <button onClick={() => addTo('red', toPlayer(s))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-xs)', color: teamColor('red') }}>레드</button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'var(--sp-4)' }}>
          <input
            style={{ ...field, flex: 1 }}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="수동 이름 입력"
          />
          <button onClick={() => addManual('blue')} style={{ ...secondaryBtn, color: teamColor('blue') }}>블루 추가</button>
          <button onClick={() => addManual('red')} style={{ ...secondaryBtn, color: teamColor('red') }}>레드 추가</button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{ ...primaryBtn, opacity: canStart ? 1 : 0.45, cursor: canStart ? 'pointer' : 'not-allowed' }}
        >
          {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
        </button>
        <button onClick={handleQuickStart} style={secondaryBtn}>
          스트리머 없이 빠른 시작
        </button>
      </div>
    </div>
  );
}
