'use client';

import { useEffect, useState } from 'react';
import { getStreamers, getPrecomputedStats } from '@/lib/firestore';
import { balanceByElo, teamElo } from '@/lib/draft/balance';
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
  const [eloMap, setEloMap] = useState<Record<string, number>>({});
  const [balanced, setBalanced] = useState(false);

  useEffect(() => {
    getStreamers().then(setStreamers).catch(() => setStreamers([]));
    // Elo 밸런싱용 — 집계 문서 1 read. 없으면(집계 전) 전원 기본 1500 취급.
    getPrecomputedStats()
      .then((s) => {
        if (!s) return;
        setEloMap(Object.fromEntries(s.playerStats.map((p) => [p.streamerId, p.eloRating ?? 1500])));
      })
      .catch(() => {});
  }, []);

  const eloOf = (id: string) => eloMap[id] ?? 1500;

  const teamOf = (id: string): Team | null =>
    blue.some((p) => p.id === id) ? 'blue' : red.some((p) => p.id === id) ? 'red' : null;

  function addTo(team: Team, player: Player) {
    if (teamOf(player.id)) return;
    const list = team === 'blue' ? blue : red;
    const setList = team === 'blue' ? setBlue : setRed;
    if (list.length >= 5) return;
    setList([...list, player]);
    setBalanced(false); // 명단이 바뀌면 밸런싱 결과(Elo 합) 무효
  }

  function removeFrom(team: Team, id: string) {
    const setList = team === 'blue' ? setBlue : setRed;
    const list = team === 'blue' ? blue : red;
    setList(list.filter((p) => p.id !== id));
    setBalanced(false);
  }

  const canStart = blue.length === 5 && red.length === 5;

  function handleStart() {
    if (!canStart) return;
    onStart({ draftType, bestOf, blue, red, sets: [], current: null });
  }

  function handleBalance() {
    if (!canStart) return;
    const r = balanceByElo(blue, red, eloOf);
    setBlue(r.blue);
    setRed(r.red);
    setBalanced(true);
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
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)', justifyItems: 'center' }}>
      <h1 style={{ ...pageTitle, fontSize: 'var(--fs-2xl)' }}>모의 밴픽</h1>

      {/* 피어리스 + Bo 선택 — 같은 행 */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Segmented value={draftType} onChange={setDraftType}
          options={(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => [k, DRAFT_LABELS[k]])} />
        <Segmented value={String(bestOf) as '3' | '5'} onChange={(v) => setBestOf(Number(v) as 3 | 5)}
          options={[['3', 'Bo3'], ['5', 'Bo5']]} />
      </div>

      {/* 블루칸 | 검색+풀 | 레드칸 (옆 칸은 상자 없이 육각만) */}
      {/* 콘텐츠 폭에 맞춘 3열 + 전체 가운데 정렬 → gap이 실제 옆칸~패널 거리 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', justifyContent: 'center',
        gap: 'var(--sp-10)', alignItems: 'start' }}>
        <TeamPanel team="blue" list={blue} onRemove={(id) => removeFrom('blue', id)} />

        {/* 중앙 패널 — 6열 고정 */}
        <div style={{ width: 600,
          border: '2px solid var(--border-strong)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
          background: 'var(--surface-card)', display: 'grid', gap: 'var(--sp-3)', alignContent: 'start' }}>
          <input style={{ ...field, width: 240, justifySelf: 'start' }} value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="스트리머 검색…" />
          <div style={{ overflowY: 'auto', maxHeight: 440, marginTop: 'var(--sp-1)', padding: 10,
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, justifyItems: 'center', alignContent: 'start' }}>
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

        <TeamPanel team="red" list={red} onRemove={(id) => removeFrom('red', id)} mirror />
      </div>

      {/* 하단 버튼 — 중앙 세로 스택, 실제 버튼 */}
      <div style={{ display: 'grid', gap: 'var(--sp-2)', justifyItems: 'center' }}>
        {/* Elo 합은 밸런싱 버튼을 누른 뒤에만 노출 */}
        {balanced && canStart && (() => {
          const b = Math.round(teamElo(blue, eloOf));
          const r = Math.round(teamElo(red, eloOf));
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              fontFamily: 'var(--font-numeral)', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: teamColor('blue'), fontWeight: 700 }}>{b}</span>
              <span style={{ color: 'var(--text-faint)' }}>Elo 합 · 차이 {Math.abs(b - r)}</span>
              <span style={{ color: teamColor('red'), fontWeight: 700 }}>{r}</span>
            </div>
          );
        })()}
        <button onClick={handleStart} disabled={!canStart}
          style={{ ...primaryBtn, minWidth: 260, opacity: canStart ? 1 : 0.5, cursor: canStart ? 'pointer' : 'not-allowed' }}>
          {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
        </button>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={handleBalance} disabled={!canStart}
            style={{ ...secondaryBtn, minWidth: 200, opacity: canStart ? 1 : 0.5, cursor: canStart ? 'pointer' : 'not-allowed' }}>
            ⚖ Elo로 팀 밸런싱
          </button>
          <button onClick={handleQuickStart} style={{ ...secondaryBtn, minWidth: 200 }}>스트리머 없이 바로 시작</button>
        </div>
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

// 팀 칸 — 상자 없이 5칸 육각만. 고정 피치(겹침)로 채워도 위치 안 흔들림.
function TeamPanel({ team, list, onRemove, mirror = false }: { team: Team; list: Player[]; onRemove: (id: string) => void; mirror?: boolean }) {
  const c = teamColor(team);
  const S = 116;
  const gap = 14;
  // 스트리머 페이지 Honeycomb과 동일한 브릭 오프셋(1열 지그재그):
  //  세로 행간격 rowMt = -0.25H + 0.866·gap, 홀수 행만 반 칸(stepX/2) 우측 오프셋 → 사선 면 맞닿음.
  const stepX = Math.round(S * 0.866 + gap);
  const rowMt = Math.round(-S * 0.25 + gap * 0.866);
  const oddOffset = Math.round(stepX / 2);
  return (
    <div style={{ width: S + oddOffset, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const p = list[i];
        // 빈/채운 칸 모두 정확히 S×S 고정 → 채워도 레이아웃 불변.
        return (
          <div key={i} style={{ position: 'relative', flex: '0 0 auto', width: S, height: S,
            marginTop: i === 0 ? 0 : rowMt, marginLeft: (mirror ? i % 2 === 0 : i % 2 === 1) ? oddOffset : 0, lineHeight: 0 }}>
            {p ? (
              <button onClick={() => onRemove(p.id)} title={`${p.name}${i === 0 ? ' (팀장)' : ''} 제거`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block', width: S, height: S }}>
                <HexAvatar name={p.name} imageUrl={p.imageUrl} ring={c} size={S} />
              </button>
            ) : (
              <span style={{ width: S, height: S, display: 'flex', clipPath: HEX_CLIP, background: c, padding: 2 }}>
                <span style={{ width: '100%', height: '100%', clipPath: HEX_CLIP,
                  background: `color-mix(in srgb, ${c} 14%, var(--surface-raise))` }} />
              </span>
            )}
            {/* 첫 칸 = 팀장 → 우측 상단 완장 스티커 */}
            {i === 0 && p && (
              <span title="팀장" style={{ position: 'absolute', top: -2, right: 6, zIndex: 3,
                width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center',
                background: c, color: 'var(--bg-void)', fontSize: 15, lineHeight: 1,
                boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>👑</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
