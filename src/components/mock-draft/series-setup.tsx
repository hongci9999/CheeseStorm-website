'use client';

import { useEffect, useState } from 'react';
import { getStreamers } from '@/lib/firestore';
import { HexAvatar } from '@/components/hexagon-avatar';
import { Segmented } from './segmented';
import type { Streamer } from '@/lib/types';
import type { Series, Player, DraftType, Team } from '@/lib/draft/types';
import { primaryBtn, secondaryBtn, field, pageTitle, teamColor } from './ui';

const HEX_CLIP = 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)';

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
  const [query, setQuery] = useState('');

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

  const q = query.trim();
  const available = streamers.filter((s) => !inRoster(s.id) && (!q || s.name.includes(q)));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 88,
      display: 'grid', gridTemplateColumns: '1fr minmax(300px, 360px) 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
      {/* 블루 로스터 — 중앙을 바라보도록 우측 정렬 */}
      <TeamRoster team="blue" list={blue} onRemove={(id) => removeFrom('blue', id)} align="end" />

      {/* 중앙 설정 */}
      <div style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center' }}>
        <h1 style={{ ...pageTitle, fontSize: 'var(--fs-2xl)' }}>모의 밴픽</h1>

        <Segmented value={draftType} onChange={setDraftType}
          options={(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => [k, DRAFT_LABELS[k]])} />
        <Segmented value={String(bestOf) as '3' | '5'} onChange={(v) => setBestOf(Number(v) as 3 | 5)}
          options={[['3', 'Bo3'], ['5', 'Bo5']]} />

        {/* 스트리머 검색 + 고정 높이 스크롤 리스트(추가박스 안 밀림) */}
        <div style={{ width: '100%', display: 'grid', gap: 6 }}>
          <input style={{ ...field, width: '100%' }} value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="스트리머 검색…" />
          <div style={{ height: 220, overflowY: 'auto', display: 'grid', gap: 4, alignContent: 'start' }}>
            {available.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 8px 5px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-input)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => addTo('blue', toPlayer(s))} disabled={blue.length >= 5}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-xs)', color: teamColor('blue'), opacity: blue.length >= 5 ? 0.4 : 1 }}>＋블루</button>
                  <button onClick={() => addTo('red', toPlayer(s))} disabled={red.length >= 5}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-xs)', color: teamColor('red'), opacity: red.length >= 5 ? 0.4 : 1 }}>＋레드</button>
                </span>
              </div>
            ))}
            {available.length === 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', textAlign: 'center', padding: 'var(--sp-3)' }}>결과 없음</span>
            )}
          </div>

          {/* 수동 이름 추가 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input style={{ ...field, flex: 1 }} value={manualName}
              onChange={(e) => setManualName(e.target.value)} placeholder="수동 이름" />
            <button onClick={() => addManual('blue')} style={{ ...secondaryBtn, height: 40, padding: '0 12px', color: teamColor('blue') }}>블루</button>
            <button onClick={() => addManual('red')} style={{ ...secondaryBtn, height: 40, padding: '0 12px', color: teamColor('red') }}>레드</button>
          </div>
        </div>
      </div>

      {/* 레드 로스터 — 좌측 정렬 */}
      <TeamRoster team="red" list={red} onRemove={(id) => removeFrom('red', id)} align="start" />

      {/* 고정 액션바 */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10,
        display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center', padding: 'var(--sp-4)',
        background: 'linear-gradient(transparent, var(--bg-app) 42%)' }}>
        <button onClick={handleStart} disabled={!canStart}
          style={{ ...primaryBtn, opacity: canStart ? 1 : 0.45, cursor: canStart ? 'pointer' : 'not-allowed' }}>
          {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
        </button>
        <button onClick={handleQuickStart} style={secondaryBtn}>스트리머 없이 빠른 시작</button>
      </div>
    </div>
  );
}

// 팀 로스터 — 5칸 육각 슬롯(채움/빈칸). align='end'면 중앙을 바라보게 우측 정렬.
function TeamRoster({ team, list, onRemove, align }: {
  team: Team; list: Player[]; onRemove: (id: string) => void; align: 'start' | 'end';
}) {
  const c = teamColor(team);
  const rowDir = align === 'end' ? 'row-reverse' : 'row';
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)', justifyItems: align === 'end' ? 'end' : 'start' }}>
      <strong style={{ color: c, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-wide)' }}>
        {team === 'blue' ? '블루' : '레드'} <span style={{ color: 'var(--text-faint)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{list.length}/5</span>
      </strong>
      {Array.from({ length: 5 }).map((_, i) => {
        const p = list[i];
        return (
          <div key={i} style={{ display: 'flex', flexDirection: rowDir, alignItems: 'center', gap: 10 }}>
            {p ? (
              <HexAvatar name={p.name} imageUrl={p.imageUrl} ring={c} size={52} />
            ) : (
              <span style={{ width: 52, height: 52, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                clipPath: HEX_CLIP, background: `color-mix(in srgb, ${c} 8%, var(--surface-raise))`, color: 'var(--text-faint)', fontSize: 18 }}>＋</span>
            )}
            {p && (
              <span style={{ display: 'flex', flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>{p.name}</span>
                <button onClick={() => onRemove(p.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>✕</button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
