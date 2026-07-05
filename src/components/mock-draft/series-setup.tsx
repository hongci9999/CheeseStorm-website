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
  const [query, setQuery] = useState('');

  useEffect(() => {
    getStreamers().then(setStreamers).catch(() => setStreamers([]));
  }, []);

  const inRoster = (id: string) =>
    blue.some((p) => p.id === id) || red.some((p) => p.id === id);

  // 팀에 플레이어 추가(5명 초과 방지, 중복 방지).
  function addTo(team: Team, player: Player) {
    const list = team === 'blue' ? blue : red;
    const setList = team === 'blue' ? setBlue : setRed;
    if (list.length >= 5 || inRoster(player.id)) return;
    setList([...list, player]);
  }

  function removeFrom(team: Team, id: string) {
    const setList = team === 'blue' ? setBlue : setRed;
    const list = team === 'blue' ? blue : red;
    setList(list.filter((p) => p.id !== id));
  }

  const canStart = blue.length === 5 && red.length === 5;

  function handleStart() {
    if (!canStart) return;
    onStart({ draftType, bestOf, blue, red, sets: [], current: null });
  }

  // 스트리머 지정 없이 기본 플레이어(블루 1~5 / 레드 1~5)로 바로 시작.
  function handleQuickStart() {
    const fill = (team: Team): Player[] =>
      Array.from({ length: 5 }, (_, i) => ({
        id: `auto:${team}:${i + 1}`,
        name: `${team === 'blue' ? '블루' : '레드'} ${i + 1}`,
      }));
    onStart({ draftType, bestOf, blue: fill('blue'), red: fill('red'), sets: [], current: null, autoAssign: true });
  }

  const q = query.trim();
  const available = streamers.filter((s) => !inRoster(s.id) && (!q || s.name.includes(q)));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 'var(--sp-6)', justifyItems: 'center' }}>
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--sp-6)', alignItems: 'center' }}>
        {/* 좌: 블루 팀 슬롯 */}
        <TeamSlots team="blue" list={blue} onRemove={(id) => removeFrom('blue', id)} />

        {/* 중앙: 설정 + 스트리머 풀 */}
        <div style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center' }}>
          <h1 style={{ ...pageTitle, fontSize: 'var(--fs-2xl)' }}>모의 밴픽</h1>

          <Segmented value={draftType} onChange={setDraftType}
            options={(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => [k, DRAFT_LABELS[k]])} />
          <Segmented value={String(bestOf) as '3' | '5'} onChange={(v) => setBestOf(Number(v) as 3 | 5)}
            options={[['3', 'Bo3'], ['5', 'Bo5']]} />

          <input style={{ ...field, width: 240 }} value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="스트리머 검색…" />

          {/* 스트리머 카드 풀 — 호버 시 확대, 좌=블루 / 우=레드 배정 */}
          <div style={{ width: '100%', maxWidth: 560, maxHeight: 360, overflowY: 'auto', padding: 6,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10, justifyItems: 'center' }}>
            {available.map((s) => (
              <PoolCard key={s.id} streamer={s}
                blueFull={blue.length >= 5} redFull={red.length >= 5}
                onAdd={(team) => addTo(team, toPlayer(s))} />
            ))}
            {available.length === 0 && (
              <span style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--sp-4)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>
                {streamers.length === 0 ? '스트리머 없음 — 아래 바로 시작 사용' : '검색 결과 없음'}
              </span>
            )}
          </div>
        </div>

        {/* 우: 레드 팀 슬롯 */}
        <TeamSlots team="red" list={red} onRemove={(id) => removeFrom('red', id)} />
      </div>

      {/* 하단 버튼 — 스케치 위치(중앙 하단, 세로 스택). 실제 버튼. */}
      <div style={{ display: 'grid', gap: 'var(--sp-2)', justifyItems: 'center' }}>
        <button onClick={handleStart} disabled={!canStart}
          style={{ ...primaryBtn, minWidth: 260, opacity: canStart ? 1 : 0.5, cursor: canStart ? 'pointer' : 'not-allowed' }}>
          {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
        </button>
        <button onClick={handleQuickStart} style={{ ...secondaryBtn, minWidth: 200 }}>스트리머 없이 바로 시작</button>
      </div>
    </div>
  );
}

// 스트리머 풀 카드 — 호버 시 확대 + 마우스 위치(좌/우)로 팀 배정.
// 좌측 호버: 파란 그라데이션 → 블루 추가 / 우측: 빨강 → 레드 추가.
function PoolCard({ streamer, onAdd, blueFull, redFull }: {
  streamer: Streamer; onAdd: (team: Team) => void; blueFull: boolean; redFull: boolean;
}) {
  const [side, setSide] = useState<Team | null>(null);
  const ring = side === 'blue' ? teamColor('blue') : side === 'red' ? teamColor('red') : 'var(--cheese-green)';
  const overlay = side === 'blue'
    ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor('blue')} 78%, transparent), transparent 70%)`
    : side === 'red'
      ? `linear-gradient(270deg, color-mix(in srgb, ${teamColor('red')} 78%, transparent), transparent 70%)`
      : undefined;

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
      <div
        onMouseLeave={() => setSide(null)}
        style={{ position: 'relative', width: 64, height: 64,
          transform: side ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform var(--dur-fast) var(--ease-out)' }}
      >
        <HexAvatar name={streamer.name} imageUrl={streamer.profileImageUrl} ring={ring} size={64} />
        {overlay && (
          <span aria-hidden style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: overlay, pointerEvents: 'none' }} />
        )}
        {/* 좌/우 히트 영역 */}
        <button aria-label="블루 추가" disabled={blueFull}
          onMouseEnter={() => !blueFull && setSide('blue')} onClick={() => onAdd('blue')}
          style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 2,
            background: 'none', border: 'none', cursor: blueFull ? 'not-allowed' : 'pointer' }} />
        <button aria-label="레드 추가" disabled={redFull}
          onMouseEnter={() => !redFull && setSide('red')} onClick={() => onAdd('red')}
          style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 2,
            background: 'none', border: 'none', cursor: redFull ? 'not-allowed' : 'pointer' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: side ? ring : 'var(--text-muted)',
        maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {streamer.name}
      </span>
    </div>
  );
}

// 팀 슬롯 5칸(세로) — 빈칸 회색 육각, 채우면 아바타. 클릭 시 제거.
function TeamSlots({ team, list, onRemove }: { team: Team; list: Player[]; onRemove: (id: string) => void }) {
  const c = teamColor(team);
  const SIZE = 76;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const p = list[i];
        if (!p) {
          return (
            <span key={i} style={{ width: SIZE, height: SIZE, display: 'inline-flex',
              clipPath: HEX_CLIP, background: `color-mix(in srgb, ${c} 8%, var(--surface-raise))` }} />
          );
        }
        return (
          <button key={p.id} onClick={() => onRemove(p.id)} title={`${p.name} 제거`}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 2 }}>
            <HexAvatar name={p.name} imageUrl={p.imageUrl} ring={c} size={SIZE} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: 'var(--text-body)',
              maxWidth: SIZE + 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
