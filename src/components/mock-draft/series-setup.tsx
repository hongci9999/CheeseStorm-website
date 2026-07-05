'use client';

import { useEffect, useState } from 'react';
import { getStreamers } from '@/lib/firestore';
import { HexAvatar } from '@/components/hexagon-avatar';
import { Segmented } from './segmented';
import type { Streamer } from '@/lib/types';
import type { Series, Player, DraftType, Team } from '@/lib/draft/types';
import { primaryBtn, secondaryBtn, field, pageTitle, teamColor } from './ui';

const HEX_CLIP = 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)';
const POOL_RING = 'var(--hots-purple)'; // 스트리머 카드 기본 테두리(스트리머 페이지와 동일 보라)

const DRAFT_LABELS: Record<DraftType, string> = {
  normal: '일반',
  soft: '소프트 피어리스',
  hard: '하드 피어리스',
};

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

  const teamOf = (id: string): Team | null =>
    blue.some((p) => p.id === id) ? 'blue' : red.some((p) => p.id === id) ? 'red' : null;

  function addTo(team: Team, player: Player) {
    if (teamOf(player.id)) return;
    const list = team === 'blue' ? blue : red;
    const setList = team === 'blue' ? setBlue : setRed;
    if (list.length >= 5) return;
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

  function handleQuickStart() {
    const fill = (team: Team): Player[] =>
      Array.from({ length: 5 }, (_, i) => ({
        id: `auto:${team}:${i + 1}`,
        name: `${team === 'blue' ? '블루' : '레드'} ${i + 1}`,
      }));
    onStart({ draftType, bestOf, blue: fill('blue'), red: fill('red'), sets: [], current: null, autoAssign: true });
  }

  const q = query.trim();
  // 풀은 검색만 반영, 배정돼도 목록에서 빼지 않음 → 선택해도 카드 위치 고정.
  const pool = streamers.filter((s) => !q || s.name.includes(q));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 'var(--sp-6)', justifyItems: 'center' }}>
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--sp-2)', alignItems: 'center' }}>
        {/* 좌: 블루 팀 슬롯(허니컴) */}
        <TeamSlots team="blue" list={blue} onRemove={(id) => removeFrom('blue', id)} />

        {/* 중앙: 설정 + 스트리머 풀 */}
        <div style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center' }}>
          <h1 style={{ ...pageTitle, fontSize: 'var(--fs-2xl)' }}>모의 밴픽</h1>

          {/* 피어리스 선택 + Bo 선택 — 같은 행 */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Segmented value={draftType} onChange={setDraftType}
              options={(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => [k, DRAFT_LABELS[k]])} />
            <Segmented value={String(bestOf) as '3' | '5'} onChange={(v) => setBestOf(Number(v) as 3 | 5)}
              options={[['3', 'Bo3'], ['5', 'Bo5']]} />
          </div>

          <input style={{ ...field, width: 240, justifySelf: 'start' }} value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="스트리머 검색…" />

          {/* 스트리머 카드 풀 — 호버 확대, 좌=블루/우=레드 배정. 배정돼도 자리 유지. */}
          <div style={{ width: '100%', maxWidth: 560, minHeight: 300, maxHeight: 360, overflowY: 'auto', padding: 6,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10, justifyItems: 'center', alignContent: 'start' }}>
            {pool.map((s) => {
              const assigned = teamOf(s.id);
              return (
                <PoolCard key={s.id} streamer={s} assigned={assigned}
                  blueFull={blue.length >= 5} redFull={red.length >= 5}
                  onAdd={(team) => addTo(team, toPlayer(s))}
                  onRemove={(team) => removeFrom(team, s.id)} />
              );
            })}
            {pool.length === 0 && (
              <span style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--sp-4)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>
                {streamers.length === 0 ? '스트리머 없음 — 아래 바로 시작 사용' : '검색 결과 없음'}
              </span>
            )}
          </div>
        </div>

        {/* 우: 레드 팀 슬롯(허니컴) */}
        <TeamSlots team="red" list={red} onRemove={(id) => removeFrom('red', id)} />
      </div>

      {/* 하단 버튼 — 중앙 세로 스택, 실제 버튼 */}
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

// 스트리머 풀 카드. 미배정: 호버 좌/우로 팀 추가. 배정됨: 흐리게 + 클릭 시 제거.
function PoolCard({ streamer, assigned, onAdd, onRemove, blueFull, redFull }: {
  streamer: Streamer; assigned: Team | null;
  onAdd: (team: Team) => void; onRemove: (team: Team) => void; blueFull: boolean; redFull: boolean;
}) {
  const [side, setSide] = useState<Team | null>(null);
  const ring = assigned ? teamColor(assigned)
    : side === 'blue' ? teamColor('blue') : side === 'red' ? teamColor('red') : POOL_RING;
  const overlay = !assigned && side === 'blue'
    ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor('blue')} 78%, transparent), transparent 70%)`
    : !assigned && side === 'red'
      ? `linear-gradient(270deg, color-mix(in srgb, ${teamColor('red')} 78%, transparent), transparent 70%)`
      : undefined;

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
      <div
        onMouseLeave={() => setSide(null)}
        style={{ position: 'relative', width: 64, height: 64,
          opacity: assigned ? 0.5 : 1,
          transform: !assigned && side ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform var(--dur-fast) var(--ease-out)' }}
      >
        <HexAvatar name={streamer.name} imageUrl={streamer.profileImageUrl} ring={ring} size={64} />
        {overlay && <span aria-hidden style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: overlay, pointerEvents: 'none' }} />}

        {assigned ? (
          <button aria-label="배정 취소" onClick={() => onRemove(assigned)}
            style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'none', border: 'none', cursor: 'pointer' }} />
        ) : (
          <>
            <button aria-label="블루 추가" disabled={blueFull}
              onMouseEnter={() => !blueFull && setSide('blue')} onClick={() => onAdd('blue')}
              style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 2,
                background: 'none', border: 'none', cursor: blueFull ? 'not-allowed' : 'pointer' }} />
            <button aria-label="레드 추가" disabled={redFull}
              onMouseEnter={() => !redFull && setSide('red')} onClick={() => onAdd('red')}
              style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 2,
                background: 'none', border: 'none', cursor: redFull ? 'not-allowed' : 'pointer' }} />
          </>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-2xs)', color: side || assigned ? ring : 'var(--text-muted)',
        maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {streamer.name}
      </span>
    </div>
  );
}

// 팀 슬롯 5칸 — 육각이 사선 면을 맞대도록 지그재그로 겹쳐 배치(허니컴). 테두리 팀색.
function TeamSlots({ team, list, onRemove }: { team: Team; list: Player[]; onRemove: (id: string) => void }) {
  const c = teamColor(team);
  const S = 96;
  const overlap = Math.round(S * 0.24); // 세로 겹침 → 사선 면 맞닿음
  const shift = Math.round(S * 0.30);   // 좌우 교차 오프셋
  return (
    <div style={{ display: 'grid', justifyItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const p = list[i];
        const dx = i % 2 === 0 ? -shift : shift;
        return (
          <div key={i} style={{ marginTop: i === 0 ? 0 : -overlap, transform: `translateX(${dx}px)` }}>
            {p ? (
              <button onClick={() => onRemove(p.id)} title={`${p.name} 제거`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}>
                <HexAvatar name={p.name} imageUrl={p.imageUrl} ring={c} size={S} />
              </button>
            ) : (
              // 빈 슬롯 — 팀색 테두리 육각
              <span style={{ width: S, height: S, display: 'flex', clipPath: HEX_CLIP, background: c, padding: 2 }}>
                <span style={{ width: '100%', height: '100%', clipPath: HEX_CLIP,
                  background: `color-mix(in srgb, ${c} 12%, var(--surface-raise))` }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
