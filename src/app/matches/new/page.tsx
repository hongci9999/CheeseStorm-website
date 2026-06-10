'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, addMatch, isFirebaseConfigured } from '@/lib/firestore';
import { validateMatchForm } from '@/lib/match';
import type { Streamer } from '@/lib/types';
import { MOCK_STREAMERS } from '@/test/fixtures';

const HOTS_MAPS = [
  '뒤틀린 식물원','공포의 정원','하늘 신전','용의 둥지','공허의 파도',
  '거미 여왕의 무덤','영원의 전쟁터','탑승구 만','불지옥 신단','볼스카야 공장','알터랙 고개',
];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px',
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border-line)',
  background: 'var(--surface-input)', color: 'var(--text-high)',
  fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontFamily: 'var(--font-numeral)', letterSpacing: '0.08em',
  color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6, display: 'block',
};

export default function NewMatchPage() {
  const router = useRouter();
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [blueTeam, setBlueTeam] = useState<[string, string][]>([]);
  const [redTeam, setRedTeam] = useState<[string, string][]>([]);
  const [winner, setWinner] = useState<'blue' | 'red'>('blue');
  const [map, setMap] = useState('');
  const [dur, setDur] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) { setStreamers(MOCK_STREAMERS); return; }
    getStreamers().then(setStreamers);
  }, []);

  function getTeam(id: string): 'blue' | 'red' | null {
    if (blueTeam.some(([x]) => x === id)) return 'blue';
    if (redTeam.some(([x]) => x === id)) return 'red';
    return null;
  }

  function assignPlayer(id: string, side: 'blue' | 'red') {
    const cur = getTeam(id);
    if (cur === side) {
      // 같은 팀 클릭 → 제거
      if (side === 'blue') setBlueTeam(p => p.filter(([x]) => x !== id));
      else setRedTeam(p => p.filter(([x]) => x !== id));
    } else {
      // 상대팀에서 제거 후 이 팀에 추가
      setBlueTeam(p => p.filter(([x]) => x !== id));
      setRedTeam(p => p.filter(([x]) => x !== id));
      if (side === 'blue') setBlueTeam(p => [...p, [id, '']]);
      else setRedTeam(p => [...p, [id, '']]);
    }
  }

  function setHero(side: 'blue' | 'red', id: string, hero: string) {
    const setter = side === 'blue' ? setBlueTeam : setRedTeam;
    setter(p => p.map(([pid, h]) => pid === id ? [pid, hero] : [pid, h]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateMatchForm(blueTeam, redTeam);
    if (!validation.valid) { setError(validation.error); return; }
    setSubmitting(true);
    setError('');
    try {
      await addMatch({
        date: new Date(date),
        blueTeam,
        redTeam,
        winner,
        map: map || undefined,
        dur: dur || undefined,
        note: note || undefined,
      });
      router.push('/matches');
    } catch {
      setError('저장 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-5)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--text-strong)', margin: 0 }}>경기 결과 입력</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* 날짜 / 맵 / 경기시간 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 'var(--sp-3)' }}>
          <div>
            <label style={LABEL_STYLE}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              required style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>맵 (선택)</label>
            <select value={map} onChange={e => setMap(e.target.value)}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}>
              <option value="">선택 안 함</option>
              {HOTS_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>경기시간</label>
            <input value={dur} onChange={e => setDur(e.target.value)}
              placeholder="21:04" style={INPUT_STYLE} />
          </div>
        </div>

        {/* 팀 배정 */}
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-line)', padding: 'var(--sp-4)' }}>
          <span style={LABEL_STYLE}>팀 배정 — 스트리머 선택 후 팀 버튼 클릭</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {streamers.map(s => {
              const team = getTeam(s.id);
              return (
                <div key={s.id} style={{ display: 'flex', borderRadius: 'var(--r-sm)', overflow: 'hidden',
                  border: `1px solid ${team === 'blue' ? 'var(--cheese-blue)' : team === 'red' ? 'var(--loss)' : 'var(--border-line)'}` }}>
                  <button type="button" onClick={() => assignPlayer(s.id, 'blue')}
                    style={{ padding: '5px 10px', background: team === 'blue' ? 'var(--cheese-blue)' : 'var(--surface-raise)',
                      color: team === 'blue' ? 'var(--text-on-blue)' : 'var(--text-faint)',
                      fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
                      border: 'none', cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)' }}>
                    B
                  </button>
                  <span style={{ padding: '5px 10px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                    fontSize: 13, color: 'var(--text-high)', background: 'var(--surface-card)',
                    borderLeft: '1px solid var(--border-line)', borderRight: '1px solid var(--border-line)' }}>
                    {s.name}
                  </span>
                  <button type="button" onClick={() => assignPlayer(s.id, 'red')}
                    style={{ padding: '5px 10px', background: team === 'red' ? 'var(--loss)' : 'var(--surface-raise)',
                      color: team === 'red' ? '#fff' : 'var(--text-faint)',
                      fontFamily: 'var(--font-numeral)', fontWeight: 700, fontSize: 11,
                      border: 'none', cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)' }}>
                    R
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 팀 편성 + 영웅 입력 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          {(['blue', 'red'] as const).map(side => {
            const team = side === 'blue' ? blueTeam : redTeam;
            const accentColor = side === 'blue' ? 'var(--cheese-blue)' : 'var(--loss)';
            const label = side === 'blue' ? '블루팀' : '레드팀';
            const slots = Array.from({ length: 5 }, (_, i) => team[i] ?? null);
            return (
              <div key={side} style={{ background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
                border: `1px solid ${team.length === 5 ? accentColor : 'var(--border-line)'}`,
                overflow: 'hidden' }}>
                <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: `color-mix(in srgb, ${accentColor} 8%, transparent)` }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                    color: accentColor }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
                    color: team.length === 5 ? accentColor : 'var(--text-faint)' }}>
                    {team.length} / 5
                  </span>
                </div>
                <div style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slots.map((slot, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                      alignItems: 'center' }}>
                      {slot ? (
                        <>
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                            color: 'var(--text-high)', padding: '0 4px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {streamers.find(s => s.id === slot[0])?.name ?? slot[0]}
                          </span>
                          <input
                            value={slot[1]}
                            onChange={e => setHero(side, slot[0], e.target.value)}
                            placeholder="영웅명"
                            style={{ ...INPUT_STYLE, height: 30, fontSize: 12,
                              borderColor: !slot[1] ? 'var(--loss-soft)' : 'var(--border-line)' }}
                          />
                        </>
                      ) : (
                        <span style={{ gridColumn: '1/-1', height: 30, borderRadius: 'var(--r-sm)',
                          border: '1px dashed var(--border-faint)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: 'var(--text-faint)' }}>
                          {i + 1}번 슬롯
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 승리팀 */}
        <div>
          <span style={LABEL_STYLE}>승리팀</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            {(['blue', 'red'] as const).map(side => {
              const active = winner === side;
              const color = side === 'blue' ? 'var(--cheese-blue)' : 'var(--loss)';
              return (
                <button key={side} type="button" onClick={() => setWinner(side)} style={{
                  height: 48, borderRadius: 'var(--r-md)', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${active ? color : 'var(--border-line)'}`,
                  background: active ? `color-mix(in srgb, ${color} 15%, var(--surface-card))` : 'var(--surface-card)',
                  color: active ? color : 'var(--text-muted)',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}>
                  {active ? '🏆 ' : ''}{side === 'blue' ? '블루팀' : '레드팀'} 승리
                </button>
              );
            })}
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label style={LABEL_STYLE}>메모 (선택)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="경기에 대한 메모..." rows={2}
            style={{ ...INPUT_STYLE, height: 'auto', padding: '8px 10px', resize: 'none' }} />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--loss)', fontFamily: 'var(--font-ui)' }}>{error}</p>
        )}

        {/* 버튼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-3)',
          paddingBottom: 'var(--sp-10)' }}>
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
