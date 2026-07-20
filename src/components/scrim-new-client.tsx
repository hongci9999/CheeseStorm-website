'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { HeroGrid } from '@/components/mock-draft/hero-grid';
import { ScrimHexStrip, BAN_COLOR, PICK_COLOR } from '@/components/scrim-card';
import {
  startSet, applyBan, applyPick, undo as undoState, currentStep, isComplete, availableHeroes,
  finishSet, heroesPickedInSeries,
} from '@/lib/draft/engine';
import { HOTS_MAPS } from '@/lib/draft/maps';
import { mapImageUrl } from '@/lib/draft/map-image';
import { addScrim } from '@/lib/api-client';
import { card, field, primaryBtn, secondaryBtn, pageTitle, selectedOutline } from '@/components/mock-draft/ui';
import type { DraftState, Team, Series, SetResult } from '@/lib/draft/types';

// 팀 규약: blue=선픽팀(윗행), red=후픽팀(아랫행) — scrim.ts 참고.
const TEAM_NAME: Record<Team, string> = { blue: '선픽팀', red: '후픽팀' };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// presence: 영웅별 밴픽률(관여율). 서버 컴포넌트가 기존 스크림 기록에서 계산해 넘긴다.
export default function ScrimNewClient({ presence }: { presence: Record<string, number> }) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [patch, setPatch] = useState('2.55.16'); // 현행 라이브 패치 — 바뀌면 수정
  const [map, setMap] = useState('');
  const [state, setState] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 하드 피어리스 세트 식별자 — 페이지 이동 없이 "다음 경기" 버튼으로 이어지는 동안 고정.
  // 세트 종료 후 목록으로 나가면 다음 방문 시 새로 생성됨.
  const [seriesId] = useState(() => crypto.randomUUID());
  // 이번 세트에서 저장한 경기들 — 하드 피어리스 잠금 계산용(엔진이 사용)이자 진행 피드백용.
  const [sets, setSets] = useState<SetResult[]>([]);
  const [justSaved, setJustSaved] = useState(false); // 저장 직후 "다음 경기 / 세트 종료" 선택 화면

  const gamesSaved = sets.length;
  // 하드 피어리스: 이미 저장한 경기에서 픽된 영웅은 이후 경기에서 픽·밴 모두 불가.
  const engineSeries = useMemo<Series>(
    () => ({ draftType: 'hard', bestOf: 5, blue: [], red: [], sets, current: null }),
    [sets],
  );
  const lockedCount = useMemo(() => heroesPickedInSeries(sets).size, [sets]);

  const step = state ? currentStep(state) : null;
  const done = state ? isComplete(state) : false;
  const available = state && step ? availableHeroes(engineSeries, state) : [];

  // 확정 버튼 없이 영웅 클릭 즉시 적용 — 실수는 되돌리기로 복구
  function pickHero(hero: string) {
    if (!state || !step || !available.includes(hero)) return;
    setState(step.kind === 'ban' ? applyBan(state, hero) : applyPick(state, hero));
  }

  function undo() {
    if (!state) return;
    setState(undoState(state));
  }

  async function save(winner: Team) {
    if (!state || !done || saving) return;
    setSaving(true);
    setError('');
    try {
      await addScrim({
        date: new Date(date),
        map: state.map,
        winner,
        ...(patch.trim() ? { patch: patch.trim() } : {}),
        bans: state.bans,
        picks: state.picks,
        seriesId,
      });
      setSets((prev) => [...prev, finishSet(state, winner)]);
      setState(null);
      setMap('');
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  function endSeries() {
    router.push('/scrims');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 'var(--sp-5)',
      display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}>
      <h1 style={pageTitle}>스크림 밴픽 기록</h1>

      {/* 하드 피어리스 세트 진행 상황 — 이번 방문에서 저장한 경기 수 */}
      {gamesSaved > 0 && (
        <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
          borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--cheese-green) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--cheese-green) 40%, transparent)',
          fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--fs-xs)', color: 'var(--cheese-green)' }}>
          이번 세트 {gamesSaved}경기 저장됨 · 하드 피어리스로 {lockedCount}영웅 잠김
        </span>
      )}

      {/* ── 경기 정보: 날짜·패치버전 ── */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={metaLabel}>날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, width: 150 }} />
        </label>
        <label style={metaLabel}>패치버전
          <input value={patch} onChange={(e) => setPatch(e.target.value)} placeholder="예: 2.55.8" style={{ ...field, width: 130 }} />
        </label>
      </div>

      {justSaved ? (
        /* ── 저장 직후: 같은 세트로 이어갈지, 종료할지 선택 ── */
        <section style={{ display: 'grid', gap: 'var(--sp-3)', justifyItems: 'center', padding: 'var(--sp-6) 0' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'var(--fs-lg)', color: 'var(--text-high)' }}>
            {gamesSaved}경기 저장 완료
          </span>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => setJustSaved(false)} style={{ ...primaryBtn, minWidth: 220 }}>
              같은 세트 다음 경기 기록
            </button>
            <button onClick={endSeries} style={secondaryBtn}>
              세트 종료 → 목록으로
            </button>
          </div>
        </section>
      ) : !state ? (
        /* ── 맵 선택 → 밴픽 시작 ── */
        <section style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
            {HOTS_MAPS.map((m) => {
              const img = mapImageUrl(m);
              const isSel = m === map;
              return (
                <button key={m} onClick={() => setMap(m)} title={m}
                  style={{ position: 'relative', height: 64, padding: 0, overflow: 'hidden',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)', cursor: 'pointer',
                    outline: isSel ? selectedOutline : 'none', outlineOffset: -2 }}>
                  {img && <Image src={img} alt={m} fill sizes="200px"
                    style={{ objectFit: 'cover', filter: map && !isSel ? 'saturate(0.7) brightness(0.55)' : 'brightness(0.8)' }} />}
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{m}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => map && setState(startSet(map, 'blue'))} disabled={!map}
            style={{ ...primaryBtn, justifySelf: 'center', minWidth: 220,
              opacity: map ? 1 : 0.45, cursor: map ? 'pointer' : 'not-allowed' }}>
            밴픽 입력 시작
          </button>
        </section>
      ) : (
        /* ── 밴픽 입력: 스트립 미리보기 + 영웅 그리드 ── */
        <section style={{ display: 'grid', gap: 'var(--sp-4)', justifyItems: 'center' }}>
          {/* 현재 차례 라벨 */}
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-md)',
            color: done ? 'var(--text-high)' : step?.kind === 'ban' ? BAN_COLOR : PICK_COLOR }}>
            {state.map} · {done ? '드래프트 완료 — 승리 팀 선택'
              : `${TEAM_NAME[step!.team]} ${step!.kind === 'ban' ? '밴' : '픽'} 차례 (${state.cursor + 1}/16)`}
          </div>

          {/* 카드와 동일한 스트립 — 채워져 가는 미리보기, 현재 슬롯 글로우 */}
          <div style={{ ...card, maxWidth: '100%', overflowX: 'auto' }}>
            <div style={{ width: 'max-content', margin: '0 auto' }}>
              <ScrimHexStrip bans={state.bans} picks={state.picks} S={64}
                highlight={done ? undefined : state.cursor} />
            </div>
          </div>

          {done ? (
            <div style={{ display: 'grid', gap: 'var(--sp-3)', justifyItems: 'center' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                {(['blue', 'red'] as Team[]).map((t) => (
                  <button key={t} onClick={() => save(t)} disabled={saving}
                    style={{ ...primaryBtn, minWidth: 160, opacity: saving ? 0.5 : 1 }}>
                    {TEAM_NAME[t]} 승리로 저장
                  </button>
                ))}
              </div>
              {error && <span style={{ color: 'var(--loss)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)' }}>{error}</span>}
            </div>
          ) : (
            <div style={{ ...card, width: '100%', maxWidth: 720 }}>
              <HeroGrid available={available} selected="" onSelect={pickHero} presence={presence} />
            </div>
          )}

          {/* 액션바: 되돌리기 (영웅 클릭 즉시 적용이라 확정 버튼 없음) */}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
            <button onClick={undo} disabled={state.cursor === 0}
              style={{ ...secondaryBtn, opacity: state.cursor === 0 ? 0.4 : 1,
                cursor: state.cursor === 0 ? 'not-allowed' : 'pointer' }}>되돌리기</button>
          </div>
        </section>
      )}
    </main>
  );
}

const metaLabel = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 600,
  color: 'var(--text-muted)',
} as const;
