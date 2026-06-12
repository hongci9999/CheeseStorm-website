'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, getMatches, addMatch, appendGameName, isFirebaseConfigured } from '@/lib/firestore';
import { validateMatchForm } from '@/lib/match';
import { matchName } from '@/lib/streamer';
import { findDuplicateMatch } from '@/lib/dedupe';
import type { Streamer, PlayerMatchStat, Match } from '@/lib/types';
import { MOCK_STREAMERS } from '@/test/fixtures';
import type { ParsedMatch } from '@/app/api/parse-screenshot/route';

const HOTS_MAPS = [
  '뒤틀린 식물원','공포의 정원','하늘 신전','용의 둥지','공허의 파도',
  '거미 여왕의 무덤','영원의 전쟁터','탑승구 만','불지옥 신단','볼스카야 공장','알터랙 고개',
];

const INPUT: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px',
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
  background: 'var(--surface-input)', color: 'var(--text-high)',
  fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontFamily: 'var(--font-numeral)', letterSpacing: '0.08em',
  color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6, display: 'block',
};

interface TeamSlot {
  extractedName: string;
  streamerId: string;
  hero: string;
  stat?: PlayerMatchStat;
}

const emptySlot = (): TeamSlot => ({ extractedName: '', streamerId: '', hero: '' });

function fmtK(n: number) { return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n); }

// ── 슬롯 컴포넌트 ─────────────────────────────────────────────
function Slot({
  slot, index, side, streamers, onUpdate,
}: {
  slot: TeamSlot; index: number; side: 'blue' | 'red';
  streamers: Streamer[]; onUpdate: (patch: Partial<TeamSlot>) => void;
}) {
  const isActive   = !!(slot.streamerId || slot.extractedName || slot.hero);
  const isUnmatched = !!(slot.extractedName && !slot.streamerId);

  return (
    <div style={{
      borderRadius: 'var(--r-sm)',
      border: `1px solid ${isUnmatched
        ? 'color-mix(in srgb, var(--loss) 50%, var(--border-line))'
        : isActive ? 'var(--border-line)' : 'var(--border-faint)'}`,
      background: isActive ? 'var(--surface-raise)' : 'transparent',
      padding: 'var(--sp-2) var(--sp-3)',
      transition: 'background var(--dur-fast) var(--ease-out)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* 미매칭 경고 */}
        {isUnmatched && (
          <span style={{ fontSize: 10, color: 'var(--loss)', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>
            ⚠ &quot;{slot.extractedName}&quot; — 스트리머를 직접 선택해주세요
          </span>
        )}

        {/* 스트리머 선택 + 영웅명 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <select
            value={slot.streamerId}
            onChange={e => onUpdate({ streamerId: e.target.value })}
            style={{ ...INPUT, height: 30, fontSize: 12, padding: '0 6px', cursor: 'pointer',
              color: slot.streamerId ? 'var(--text-high)' : 'var(--text-faint)',
              borderColor: isUnmatched ? 'var(--loss)' : 'var(--border-line)' }}
          >
            <option value="">{isActive ? '스트리머 선택' : `슬롯 ${index + 1}`}</option>
            {streamers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            value={slot.hero}
            onChange={e => onUpdate({ hero: e.target.value })}
            placeholder="영웅명"
            style={{ ...INPUT, height: 30, fontSize: 12,
              borderColor: slot.streamerId && !slot.hero ? 'var(--loss-soft)' : 'var(--border-line)',
              color: slot.hero ? 'var(--text-high)' : 'var(--text-faint)' }}
          />
        </div>

        {/* 스탯 행 */}
        {slot.stat ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px',
            fontFamily: 'var(--font-numeral)', fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              {slot.stat.kills}K/{slot.stat.assists}A/{slot.stat.deaths}D
            </span>
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span style={{ color: 'var(--text-faint)' }}>딜 {fmtK(slot.stat.heroDmg)}</span>
            <span style={{ color: 'var(--text-faint)' }}>공성 {fmtK(slot.stat.siegeDmg)}</span>
            {slot.stat.healing > 0 && (
              <span style={{ color: 'var(--text-faint)' }}>힐 {fmtK(slot.stat.healing)}</span>
            )}
            {slot.stat.selfHeal > 0 && (
              <span style={{ color: 'var(--text-faint)' }}>자힐 {fmtK(slot.stat.selfHeal)}</span>
            )}
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span style={{ color: 'var(--text-faint)' }}>XP {fmtK(slot.stat.xp)}</span>
          </div>
        ) : (
          /* 스탯 플레이스홀더 칩 */
          <div style={{ display: 'flex', gap: 4 }}>
            {['K/A/D', '딜', '공성', 'XP'].map(lbl => (
              <span key={lbl} style={{
                padding: '1px 7px', borderRadius: 3, fontSize: 10,
                fontFamily: 'var(--font-numeral)', color: 'var(--text-faint)',
                border: '1px dashed var(--border-faint)',
              }}>{lbl}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 페이지 ─────────────────────────────────────────────────────
export default function NewMatchPage() {
  const router     = useRouter();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [blueSlots, setBlueSlots] = useState<TeamSlot[]>(() => Array.from({ length: 5 }, emptySlot));
  const [redSlots,  setRedSlots]  = useState<TeamSlot[]>(() => Array.from({ length: 5 }, emptySlot));
  const [winner,   setWinner]   = useState<'blue' | 'red'>('blue');
  // 인게임 좌측 진영 버킷 — 미지정 시 undefined로 저장 생략
  const [leftTeam, setLeftTeam] = useState<'blue' | 'red' | ''>('');
  const [map,      setMap]      = useState('');
  const [dur,      setDur]      = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [note,     setNote]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parsing,    setParsing]    = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const [error,      setError]      = useState('');
  // 중복 경고: level(strong/weak) + 기존 경기 참조. null이면 경고 없음
  const [dupWarning, setDupWarning] = useState<{ level: 'strong' | 'weak'; match: Match } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) { setStreamers(MOCK_STREAMERS); return; }
    getStreamers().then(setStreamers);
  }, []);

  async function processImage(file: File) {
    setParsing(true);
    setParseError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/parse-screenshot', { method: 'POST', body: fd });
      if (!res.ok) { setParseError((await res.json()).error ?? '파싱 실패'); return; }
      const parsed: ParsedMatch = await res.json();

      if (parsed.map)    setMap(parsed.map);
      if (parsed.dur)    setDur(parsed.dur);
      if (parsed.winner) setWinner(parsed.winner);

      function buildSlots(players: ParsedMatch['blueTeam']): TeamSlot[] {
        const slots: TeamSlot[] = players.map(p => ({
          extractedName: p.name,
          streamerId:    matchName(p.name, streamers),
          hero:          p.hero,
          stat: {
            kills: p.kills, assists: p.assists, deaths: p.deaths,
            siegeDmg: p.siegeDmg, heroDmg: p.heroDmg,
            healing: p.healing, selfHeal: p.selfHeal, xp: p.xp,
          },
        }));
        while (slots.length < 5) slots.push(emptySlot());
        return slots;
      }
      setBlueSlots(buildSlots(parsed.blueTeam));
      setRedSlots(buildSlots(parsed.redTeam));
    } catch {
      setParseError('서버 오류');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function patchSlot(side: 'blue' | 'red', i: number, patch: Partial<TeamSlot>) {
    const slots = side === 'blue' ? blueSlots : redSlots;
    const current = slots[i];

    // 자가학습: 미매칭 슬롯(extractedName 있고 기존 streamerId 없음)을 수동으로 스트리머에 지정하면
    // 해당 추출 이름을 그 스트리머의 gameNames에 append → 다음 OCR부터 자동 매칭됨.
    if (
      patch.streamerId &&
      !current.streamerId &&
      current.extractedName &&
      isFirebaseConfigured
    ) {
      appendGameName(patch.streamerId, current.extractedName).catch(() => {
        // 자가학습 실패는 무시 — 경기 저장에 영향 없음
      });
      // 로컬 state도 즉시 반영 (다음 matchName 호출 시 바로 매칭되도록)
      setStreamers(prev =>
        prev.map(s =>
          s.id === patch.streamerId
            ? { ...s, gameNames: [...(s.gameNames ?? []), current.extractedName] }
            : s,
        ),
      );
    }

    (side === 'blue' ? setBlueSlots : setRedSlots)(
      prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    );
  }

  const toTeam  = (slots: TeamSlot[]): [string, string][] =>
    slots.filter(s => s.streamerId).map(s => [s.streamerId, s.hero]);

  const toStats = (slots: TeamSlot[]): PlayerMatchStat[] | undefined => {
    const active = slots.filter(s => s.streamerId);
    const stats  = active.map(s => s.stat).filter((x): x is PlayerMatchStat => !!x);
    return stats.length === active.length && stats.length > 0 ? stats : undefined;
  };

  async function handleSubmit(e: React.FormEvent, forceSubmit = false) {
    e.preventDefault();
    const blueTeam = toTeam(blueSlots);
    const redTeam  = toTeam(redSlots);
    const v = validateMatchForm(blueTeam, redTeam);
    if (!v.valid) { setError(v.error); return; }

    // 중복 경고가 없는 첫 제출 시 탐지 수행
    if (!forceSubmit) {
      const existingMatches = isFirebaseConfigured ? await getMatches() : [];
      const dup = findDuplicateMatch(
        { date: new Date(date), blueTeam, redTeam, dur: dur || undefined },
        existingMatches,
      );
      if (dup.level !== 'none' && dup.match) {
        setDupWarning({ level: dup.level, match: dup.match });
        return; // 경고 표시 후 중단 — 사용자가 계속 진행 선택 가능
      }
    }

    setSubmitting(true); setError(''); setDupWarning(null);
    try {
      await addMatch({
        date: new Date(date), blueTeam, redTeam,
        blueStats: toStats(blueSlots), redStats: toStats(redSlots),
        winner,
        leftTeam: leftTeam || undefined,
        map: map || undefined, dur: dur || undefined, note: note || undefined,
      });
      router.push('/matches');
    } catch {
      setError('저장 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-5)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--text-strong)', margin: 0 }}>경기 결과 입력</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* ── 스크린샷 업로드 존 ── */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processImage(f); }} />

        <div
          onClick={() => !parsing && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processImage(f); }}
          style={{
            borderRadius: 'var(--r-lg)', cursor: parsing ? 'default' : 'pointer',
            border: `2px dashed ${dragOver ? 'var(--cheese-green)' : parsing ? 'var(--border-faint)' : 'var(--border-line)'}`,
            background: dragOver
              ? 'color-mix(in srgb, var(--cheese-green) 6%, var(--surface-card))'
              : 'var(--surface-card)',
            padding: 'var(--sp-6)', textAlign: 'center',
            transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
          }}
        >
          {parsing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 30, opacity: 0.6 }}>⏳</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>
                Gemini가 스크린샷을 분석 중...
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 30 }}>📷</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--text-high)' }}>
                경기 결과 스크린샷 업로드
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-faint)' }}>
                클릭하거나 파일을 드래그 · 팀 구성·영웅·스탯이 아래 슬롯에 자동으로 채워집니다
              </span>
            </div>
          )}
          {parseError && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--loss)', fontFamily: 'var(--font-ui)' }}>
              {parseError}
            </p>
          )}
        </div>

        {/* ── 날짜 / 맵 / 경기시간 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 'var(--sp-3)' }}>
          <div>
            <label style={LABEL}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>맵 (선택)</label>
            <select value={map} onChange={e => setMap(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
              <option value="">선택 안 함</option>
              {HOTS_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>경기시간</label>
            <input value={dur} onChange={e => setDur(e.target.value)} placeholder="21:04" style={INPUT} />
          </div>
        </div>

        {/* ── 팀 슬롯 패널 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          {(['blue', 'red'] as const).map(side => {
            const slots      = side === 'blue' ? blueSlots : redSlots;
            const accent     = side === 'blue' ? 'var(--cheese-blue)' : 'var(--loss)';
            // 데이터 키(blueTeam/redTeam)는 내부 버킷 식별자 — UI에는 '팀 1/팀 2'로 표기
            const label      = side === 'blue' ? '팀 1' : '팀 2';
            const filledCount = slots.filter(s => s.streamerId).length;

            return (
              <div key={side} style={{
                background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
                border: `1px solid ${filledCount === 5 ? accent : 'var(--border-line)'}`,
                overflow: 'hidden',
                transition: 'border-color var(--dur-fast) var(--ease-out)',
              }}>
                {/* 헤더 */}
                <div style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderBottom: '1px solid var(--border-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: `color-mix(in srgb, ${accent} 8%, transparent)`,
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: accent }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
                    color: filledCount === 5 ? accent : 'var(--text-faint)' }}>
                    {filledCount} / 5
                  </span>
                </div>

                {/* 슬롯 목록 */}
                <div style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {slots.map((slot, i) => (
                    <Slot
                      key={i}
                      slot={slot}
                      index={i}
                      side={side}
                      streamers={streamers}
                      onUpdate={patch => patchSlot(side, i, patch)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 승리팀 ── */}
        <div>
          <span style={LABEL}>승리팀</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            {(['blue', 'red'] as const).map(side => {
              const active = winner === side;
              const color  = side === 'blue' ? 'var(--cheese-blue)' : 'var(--loss)';
              // 데이터 키(blue/red)는 버킷 식별자 — 버튼 텍스트는 '팀 1/팀 2'로 표기
              const teamLabel = side === 'blue' ? '팀 1' : '팀 2';
              return (
                <button key={side} type="button" onClick={() => setWinner(side)} style={{
                  height: 48, borderRadius: 'var(--r-md)', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${active ? color : 'var(--border-line)'}`,
                  background: active ? `color-mix(in srgb, ${color} 15%, var(--surface-card))` : 'var(--surface-card)',
                  color: active ? color : 'var(--text-muted)',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}>
                  {active ? '🏆 ' : ''}{teamLabel} 승리
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 인게임 진영 (선택) ── */}
        <div>
          <label style={LABEL}>인게임 진영 (선택)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
            {([
              { value: '',     label: '모름' },
              { value: 'blue', label: '팀 1이 좌측' },
              { value: 'red',  label: '팀 2가 좌측' },
            ] as { value: '' | 'blue' | 'red'; label: string }[]).map(opt => {
              const active = leftTeam === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLeftTeam(opt.value)}
                  style={{
                    height: 36, borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)',
                    fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
                    background: active
                      ? 'color-mix(in srgb, var(--cheese-green) 12%, var(--surface-card))'
                      : 'var(--surface-card)',
                    color: active ? 'var(--cheese-green)' : 'var(--text-muted)',
                    transition: 'all var(--dur-fast) var(--ease-out)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 메모 ── */}
        <div>
          <label style={LABEL}>메모 (선택)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="경기에 대한 메모..." rows={2}
            style={{ ...INPUT, height: 'auto', padding: '8px 10px', resize: 'none' }} />
        </div>

        {/* ── 중복 경고 배너 ── */}
        {dupWarning && (
          <div style={{
            borderRadius: 'var(--r-md)',
            border: `1px solid ${dupWarning.level === 'strong' ? 'var(--loss)' : 'color-mix(in srgb, var(--loss) 50%, var(--border-line))'}`,
            background: dupWarning.level === 'strong'
              ? 'color-mix(in srgb, var(--loss) 8%, var(--surface-card))'
              : 'color-mix(in srgb, var(--loss) 4%, var(--surface-card))',
            padding: 'var(--sp-3) var(--sp-4)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
          }}>
            <p style={{ margin: 0, fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--loss)', fontWeight: 600 }}>
              {dupWarning.level === 'strong'
                ? '⚠ 동일한 경기가 이미 존재합니다 (날짜·멤버·경기시간 일치)'
                : '⚠ 같은 날짜·멤버 구성의 경기가 있습니다 (경기시간 미입력으로 확인 불가)'}
            </p>
            <p style={{ margin: 0, fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
              경기 날짜: {dupWarning.match.date instanceof Date
                ? dupWarning.match.date.toLocaleDateString('ko-KR')
                : new Date(dupWarning.match.date).toLocaleDateString('ko-KR')}
              {dupWarning.match.dur ? ` · 경기시간: ${dupWarning.match.dur}` : ''}
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
              <button
                type="button"
                onClick={() => setDupWarning(null)}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border-line)', background: 'transparent',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 12, cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={e => handleSubmit(e as unknown as React.FormEvent, true)}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--loss)', background: 'transparent',
                  color: 'var(--loss)', fontFamily: 'var(--font-ui)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >중복 무시하고 저장</button>
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 13, color: 'var(--loss)', fontFamily: 'var(--font-ui)' }}>{error}</p>
        )}

        {/* ── 버튼 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-3)', paddingBottom: 'var(--sp-10)' }}>
          <button type="button" onClick={() => router.back()} style={{
            height: 44, borderRadius: 'var(--r-md)', border: '1px solid var(--border-line)',
            background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>취소</button>
          <button type="submit" disabled={submitting} style={{
            height: 44, borderRadius: 'var(--r-md)', border: 'none',
            background: submitting ? 'var(--ink-600)' : 'var(--cheese-green)',
            color: 'var(--text-on-green)', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
