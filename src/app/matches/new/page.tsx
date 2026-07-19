'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getStreamers, getMatches, getMatch, getOcrCorrections, getTournamentGameLink, isFirebaseConfigured,
} from '@/lib/firestore';
import { addMatch, updateMatch, upsertOcrCorrection, type TournamentTeamsPayload } from '@/lib/api-client';
import { validateMatchForm, parseMatchDur } from '@/lib/match';
import { TOURNAMENT_TEAMS, guessTournamentTeams } from '@/lib/tournament';
import {
  resolveStreamerId,
  resolveHeroName,
  shouldRecordStreamerCorrection,
  shouldRecordHeroCorrection,
  EMPTY_OCR_CORRECTIONS,
  normalizeOcrKey,
} from '@/lib/ocr-corrections';
import { isKnownHero, KNOWN_HEROES } from '@/lib/heroes';
import { findDuplicateMatch } from '@/lib/dedupe';
import { HOTS_MAPS, resolveMapName } from '@/lib/draft/maps';
import type { Streamer, PlayerMatchStat, Match } from '@/lib/types';
import type { ParsedMatch } from '@/app/api/parse-screenshot/route';

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
  extractedHero: string;
  streamerId: string;
  hero: string;
  stat?: PlayerMatchStat;
}

const emptySlot = (): TeamSlot => ({ extractedName: '', extractedHero: '', streamerId: '', hero: '' });

const emptyStat = (): PlayerMatchStat => ({
  kills: 0, assists: 0, deaths: 0, siegeDmg: 0, heroDmg: 0, healing: 0, selfHeal: 0, xp: 0,
});

// 세부 스탯 수동 입력 필드 정의 (입력 그리드 순서)
const STAT_FIELDS: { key: keyof PlayerMatchStat; label: string }[] = [
  { key: 'kills',    label: '킬' },
  { key: 'assists',  label: '어시' },
  { key: 'deaths',   label: '데스' },
  { key: 'xp',       label: '경험치' },
  { key: 'heroDmg',  label: '영웅딜' },
  { key: 'siegeDmg', label: '공성딜' },
  { key: 'healing',  label: '힐' },
  { key: 'selfHeal', label: '자힐' },
];

function fmtStat(n: number) { return n.toLocaleString('ko-KR'); }

// 세부 스탯 요약 — OCR 검토용, 라벨·값 인라인, k 축약 없음
function StatChip({ label, value, accent }: { label: string; value: string; accent?: 'dmg' | 'heal' }) {
  const color = accent === 'heal' ? 'var(--cheese-green)'
    : accent === 'dmg' ? 'var(--cheese-blue)' : 'var(--text-high)';
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, width: '100%', minWidth: 0, paddingRight: 6 }}>
      <span style={{
        flexShrink: 0, fontSize: 9, fontFamily: 'var(--font-numeral)', letterSpacing: '0.04em',
        color: 'var(--text-faint)',
      }}>{label}</span>
      <span style={{
        flex: 1, textAlign: 'right',
        fontFamily: 'var(--font-numeral)', fontSize: 11.5, fontWeight: 700,
        color, lineHeight: 1, minWidth: 0,
      }}>{value}</span>
    </span>
  );
}

// 그리드 열 구분 — 2·3열에 흐릿한 세로선
function StatCell({ divider, children }: { divider?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      borderLeft: divider ? '1px solid color-mix(in srgb, var(--border-line) 75%, var(--cheese-blue))' : undefined,
      paddingLeft: divider ? 8 : 0,
      minWidth: 0,
    }}>
      {children}
    </div>
  );
}

// 세부 스탯 3×2 그리드 — 열 단위 배치 + 세로 구분선
function StatSummaryGrid({ stat }: { stat: PlayerMatchStat }) {
  const cols = [
    [
      { label: 'K/A/D', value: `${stat.kills}/${stat.assists}/${stat.deaths}` as string },
      { label: '힐', value: fmtStat(stat.healing), accent: 'heal' as const },
    ],
    [
      { label: '영웅딜', value: fmtStat(stat.heroDmg), accent: 'dmg' as const },
      { label: '자힐', value: fmtStat(stat.selfHeal), accent: 'heal' as const },
    ],
    [
      { label: '공성', value: fmtStat(stat.siegeDmg), accent: 'dmg' as const },
      { label: 'XP', value: fmtStat(stat.xp) },
    ],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', flex: 1, minWidth: 0 }}>
      {cols.map((col, ci) => (
        <StatCell key={ci} divider={ci !== 0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {col.map(({ label, value, accent }) => (
              <StatChip key={label} label={label} value={value} accent={accent} />
            ))}
          </div>
        </StatCell>
      ))}
    </div>
  );
}

function StatBar({
  statOpen, onToggle, isActive, children,
}: {
  statOpen: boolean; onToggle: () => void; isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 6px', borderRadius: 'var(--r-sm)',
      background: 'color-mix(in srgb, var(--cheese-blue) 10%, var(--surface-raise))',
      border: '1px solid color-mix(in srgb, var(--cheese-blue) 30%, var(--border-line))',
    }}>
      {children}
      {isActive && (
        <button
          type="button"
          onClick={onToggle}
          style={{
            flexShrink: 0, alignSelf: 'center', height: 18, padding: '0 5px', borderRadius: 2,
            border: '1px solid var(--border-line)', background: 'transparent',
            color: statOpen ? 'var(--cheese-green)' : 'var(--text-faint)',
            fontFamily: 'var(--font-ui)', fontSize: 9.5, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {statOpen ? '접기' : '수정'}
        </button>
      )}
    </div>
  );
}

// ── 슬롯 컴포넌트 ─────────────────────────────────────────────
function Slot({
  slot, index, side, streamers, onUpdate, swapPicked, onSwapPick,
}: {
  slot: TeamSlot; index: number; side: 'blue' | 'red';
  streamers: Streamer[]; onUpdate: (patch: Partial<TeamSlot>) => void;
  swapPicked: boolean; onSwapPick: () => void;
}) {
  const isActive   = !!(slot.streamerId || slot.extractedName || slot.hero);
  const isUnmatched = !!(slot.extractedName && !slot.streamerId);
  // 영웅명이 입력됐는데 알려진 영웅 목록에 없으면 경고 (OCR 오타 등)
  const heroUnknown = !!slot.hero.trim() && !isKnownHero(slot.hero);
  // 세부 스탯 수동 입력 패널 펼침 상태
  const [statOpen, setStatOpen] = useState(false);

  // 스탯 단일 필드 갱신 — 없으면 0으로 초기화한 뒤 해당 값만 교체
  const updateStat = (key: keyof PlayerMatchStat, raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw)));
    const base = slot.stat ?? emptyStat();
    onUpdate({ stat: { ...base, [key]: Number.isFinite(n) ? n : 0 } });
  };

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

        {/* 스트리머 선택 + 영웅명 + 팀 교체 버튼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 26px', gap: 6 }}>
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
            list="hots-heroes"
            style={{ ...INPUT, height: 30, fontSize: 12,
              borderColor: heroUnknown ? 'var(--loss)'
                : slot.streamerId && !slot.hero ? 'var(--loss-soft)' : 'var(--border-line)',
              color: slot.hero ? 'var(--text-high)' : 'var(--text-faint)' }}
          />
          {/* 팀 교체 — 이 버튼과 상대 팀 슬롯의 버튼을 차례로 누르면 두 슬롯이 통째로 맞바뀐다 */}
          <button type="button" onClick={onSwapPick}
            title={swapPicked ? '교체 선택 해제' : '상대 팀 슬롯과 교체'}
            style={{ height: 30, borderRadius: 'var(--r-xs)', cursor: 'pointer', fontSize: 13,
              border: `1px solid ${swapPicked ? 'var(--cheese-green)' : 'var(--border-line)'}`,
              background: 'transparent',
              color: swapPicked ? 'var(--cheese-green)' : 'var(--text-faint)' }}>⇄</button>
        </div>

        {/* 영웅 목록에 없는 이름 경고 */}
        {heroUnknown && (
          <span style={{ fontSize: 10, color: 'var(--loss)', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>
            ⚠ &quot;{slot.hero}&quot; — 영웅 목록에 없음 (오타 확인)
          </span>
        )}

        {/* 세부 스탯 — 3×2 그리드 */}
        {slot.stat ? (
          <StatBar statOpen={statOpen} onToggle={() => setStatOpen(o => !o)} isActive={isActive}>
            <StatSummaryGrid stat={slot.stat} />
          </StatBar>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 6px', borderRadius: 'var(--r-sm)',
            border: '1px dashed var(--border-faint)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', flex: 1, minWidth: 0 }}>
              {[
                ['K/A/D', '힐'],
                ['영웅딜', '자힐'],
                ['공성', 'XP'],
              ].map((col, ci) => (
                <StatCell key={ci} divider={ci !== 0}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {col.map(lbl => (
                      <span key={lbl} style={{
                        padding: '0 5px', borderRadius: 2, fontSize: 9.5,
                        fontFamily: 'var(--font-numeral)', color: 'var(--text-faint)',
                        border: '1px dashed var(--border-faint)',
                      }}>{lbl}</span>
                    ))}
                  </div>
                </StatCell>
              ))}
            </div>
            {isActive && (
              <button
                type="button"
                onClick={() => setStatOpen(o => !o)}
                style={{
                  flexShrink: 0, height: 18, padding: '0 5px', borderRadius: 2,
                  border: '1px solid var(--border-line)', background: 'transparent',
                  color: statOpen ? 'var(--cheese-green)' : 'var(--text-faint)',
                  fontFamily: 'var(--font-ui)', fontSize: 9.5, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {statOpen ? '접기' : '입력'}
              </button>
            )}
          </div>
        )}

        {/* 세부 스탯 수동 입력 그리드 */}
        {isActive && statOpen && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
            paddingTop: 4, borderTop: '1px dashed var(--border-faint)',
          }}>
            {STAT_FIELDS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-numeral)', letterSpacing: '0.04em',
                  color: 'var(--text-faint)', textTransform: 'uppercase',
                }}>{label}</span>
                <input
                  inputMode="numeric"
                  value={slot.stat ? String(slot.stat[key]) : ''}
                  onChange={e => updateStat(key, e.target.value)}
                  placeholder="0"
                  style={{ ...INPUT, height: 26, fontSize: 11, padding: '0 8px 0 5px', textAlign: 'right' }}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 페이지 ─────────────────────────────────────────────────────
// useSearchParams() → Suspense 경계 필요 (Next.js 빌드 요구사항)
export default function NewMatchPage() {
  return (
    <Suspense>
      <NewMatchPageInner />
    </Suspense>
  );
}

function NewMatchPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editId       = searchParams.get('edit');
  const fileRef    = useRef<HTMLInputElement>(null);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [ocrCorrections, setOcrCorrections] = useState(EMPTY_OCR_CORRECTIONS);
  const [blueSlots, setBlueSlots] = useState<TeamSlot[]>(() => Array.from({ length: 5 }, emptySlot));
  const [redSlots,  setRedSlots]  = useState<TeamSlot[]>(() => Array.from({ length: 5 }, emptySlot));
  const [winner,   setWinner]   = useState<'blue' | 'red'>('blue');
  // 인게임 좌측 진영 버킷 — 미지정 시 undefined로 저장 생략
  const [leftTeam, setLeftTeam] = useState<'blue' | 'red' | ''>('');
  // 밴픽 선픽 팀 버킷 (대회 스크림용) — 미지정 시 undefined로 저장 생략
  const [firstPick, setFirstPick] = useState<'blue' | 'red' | ''>('');
  // 대회 경기 태깅 — 켜면 blueTeamId/redTeamId 선택, 별도 tournamentGames 컬렉션에 기록
  const [isTournament, setIsTournament] = useState(false);
  const [tourBlueTeam, setTourBlueTeam] = useState('');
  const [tourRedTeam, setTourRedTeam] = useState('');
  const [map,      setMap]      = useState('');
  const [dur,      setDur]      = useState('');
  // 팀별 최종 레벨 (선택) — HotS 공유 레벨
  const [blueLevel, setBlueLevel] = useState('');
  const [redLevel,  setRedLevel]  = useState('');
  // 로컬(KST) 기준 오늘 날짜 — toISOString은 UTC라 자정~오전9시 하루 밀림
  const [date,     setDate]     = useState(new Date().toLocaleDateString('en-CA'));
  const [note,     setNote]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parsing,    setParsing]    = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const [error,      setError]      = useState('');
  // AI 분석 완료 후 확인 안내 배너 표시
  const [showAiVerifyNotice, setShowAiVerifyNotice] = useState(false);
  // 중복 경고: level(strong/weak) + 기존 경기 참조. null이면 경고 없음
  const [dupWarning, setDupWarning] = useState<{ level: 'strong' | 'weak'; match: Match } | null>(null);
  // 팀 교체 대기 중인 슬롯 (⇄ 첫 클릭)
  const [swapPick, setSwapPick] = useState<{ side: 'blue' | 'red'; i: number } | null>(null);

  useEffect(() => {
    getStreamers().then(setStreamers);
    getOcrCorrections().then(setOcrCorrections);
  }, []);

  // 편집 모드: 기존 경기 데이터를 모든 폼 필드에 프리필
  useEffect(() => {
    if (!editId || !isFirebaseConfigured) return;
    getMatch(editId).then(m => {
      if (!m) return;
      setDate(m.date.toISOString().split('T')[0]);
      setMap(resolveMapName(m.map ?? '')); // 과거 오기(전장터 등) 저장분도 셀렉트에 매칭
      setDur(m.dur ?? '');
      setWinner(m.winner);
      setLeftTeam(m.leftTeam ?? '');
      setFirstPick(m.firstPick ?? '');
      setBlueLevel(m.blueLevel != null ? String(m.blueLevel) : '');
      setRedLevel(m.redLevel != null ? String(m.redLevel) : '');
      setNote(m.note ?? '');
      function toSlots(team: [string, string][], stats?: PlayerMatchStat[]): TeamSlot[] {
        const slots: TeamSlot[] = team.map(([streamerId, hero], i) => ({
          extractedName: '',
          extractedHero: '',
          streamerId,
          hero,
          ...(stats?.[i] ? { stat: stats[i] } : {}),
        }));
        while (slots.length < 5) slots.push(emptySlot());
        return slots;
      }
      setBlueSlots(toSlots(m.blueTeam, m.blueStats));
      setRedSlots(toSlots(m.redTeam, m.redStats));
    });
    getTournamentGameLink(editId).then((link) => {
      if (!link) return;
      setIsTournament(true);
      setTourBlueTeam(link.blueTeamId);
      setTourRedTeam(link.redTeamId);
    });
  }, [editId]);

  async function processImage(file: File) {
    setParsing(true);
    setParseError('');
    setShowAiVerifyNotice(false);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/parse-screenshot', { method: 'POST', body: fd });
      if (!res.ok) { setParseError((await res.json()).error ?? '파싱 실패'); return; }
      const parsed: ParsedMatch = await res.json();

      if (parsed.map)    setMap(resolveMapName(parsed.map));
      if (parsed.dur) {
        const d = parseMatchDur(parsed.dur);
        setDur(d.valid ? (d.value ?? '') : parsed.dur);
      }
      if (parsed.winner) setWinner(parsed.winner);
      if (parsed.blueLevel != null) setBlueLevel(String(parsed.blueLevel));
      if (parsed.redLevel != null)  setRedLevel(String(parsed.redLevel));

      function buildSlots(players: ParsedMatch['blueTeam']): TeamSlot[] {
        const slots: TeamSlot[] = players.map(p => ({
          extractedName: p.name,
          extractedHero: p.hero,
          streamerId:    resolveStreamerId(p.name, streamers, ocrCorrections),
          hero:          resolveHeroName(p.hero, ocrCorrections),
          stat: {
            kills: Number(p.kills) || 0, assists: Number(p.assists) || 0, deaths: Number(p.deaths) || 0,
            siegeDmg: Number(p.siegeDmg) || 0, heroDmg: Number(p.heroDmg) || 0,
            healing: Number(p.healing) || 0, selfHeal: Number(p.selfHeal) || 0, xp: Number(p.xp) || 0,
          },
        }));
        while (slots.length < 5) slots.push(emptySlot());
        return slots;
      }
      setBlueSlots(buildSlots(parsed.blueTeam));
      setRedSlots(buildSlots(parsed.redTeam));
      setShowAiVerifyNotice(true);
    } catch {
      setParseError('서버 오류');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function recordCorrection(kind: 'streamer' | 'hero', wrong: string, correct: string) {
    const key = normalizeOcrKey(wrong);
    if (!key) return;
    const field = kind === 'streamer' ? 'streamers' : 'heroes';
    setOcrCorrections(prev => ({
      ...prev,
      [field]: { ...prev[field], [key]: correct },
    }));
    if (isFirebaseConfigured) {
      upsertOcrCorrection(kind, wrong, correct).catch(() => {
        // 교정맵 저장 실패는 무시 — 경기 저장에 영향 없음
      });
    }
  }

  // AI 입력이 팀을 섞어 넣은 경우 교정 — 양 팀 슬롯을 하나씩 골라 통째로 맞바꾼다.
  // 슬롯에 스트리머·영웅·스탯이 함께 들어 있어 스왑만으로 정합성이 유지된다.
  function handleSwapPick(side: 'blue' | 'red', i: number) {
    if (!swapPick) { setSwapPick({ side, i }); return; }
    // 같은 팀 재선택 — 순서만 바뀌므로 교체 없이 선택만 옮긴다
    if (swapPick.side === side) { setSwapPick(swapPick.i === i ? null : { side, i }); return; }
    const bi = side === 'blue' ? i : swapPick.i;
    const ri = side === 'red' ? i : swapPick.i;
    const blueSlot = blueSlots[bi];
    const redSlot = redSlots[ri];
    setBlueSlots(prev => prev.map((s, k) => (k === bi ? redSlot : s)));
    setRedSlots(prev => prev.map((s, k) => (k === ri ? blueSlot : s)));
    setSwapPick(null);
  }

  function patchSlot(side: 'blue' | 'red', i: number, patch: Partial<TeamSlot>) {
    const slots = side === 'blue' ? blueSlots : redSlots;
    const current = slots[i];

    if (patch.streamerId && shouldRecordStreamerCorrection(
      current.extractedName, patch.streamerId, streamers, ocrCorrections,
    )) {
      recordCorrection('streamer', current.extractedName, patch.streamerId);
    }

    if (patch.hero !== undefined && shouldRecordHeroCorrection(
      current.extractedHero, patch.hero, ocrCorrections,
    )) {
      recordCorrection('hero', current.extractedHero, patch.hero);
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

    const durParsed = parseMatchDur(dur);
    if (!durParsed.valid) { setError(durParsed.error); return; }
    const normalizedDur = durParsed.value;

    // 편집 모드에서는 중복 체크 생략 (자기 자신이 중복으로 감지됨)
    if (!forceSubmit && !editId) {
      const existingMatches = isFirebaseConfigured ? await getMatches() : [];
      const dup = findDuplicateMatch(
        { date: new Date(date), blueTeam, redTeam, dur: normalizedDur },
        existingMatches,
      );
      if (dup.level !== 'none' && dup.match) {
        setDupWarning({ level: dup.level, match: dup.match });
        return; // 경고 표시 후 중단 — 사용자가 계속 진행 선택 가능
      }
    }

    setSubmitting(true); setError(''); setDupWarning(null);
    try {
      const parseLevel = (s: string) => {
        const n = Number(s);
        return s.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : undefined;
      };
      const data = {
        date: new Date(date), blueTeam, redTeam,
        blueStats: toStats(blueSlots), redStats: toStats(redSlots),
        winner,
        leftTeam: leftTeam || undefined,
        firstPick: firstPick || undefined,
        blueLevel: parseLevel(blueLevel), redLevel: parseLevel(redLevel),
        map: map || undefined, dur: normalizedDur, note: note || undefined,
      };
      // 대회 경기 태깅 — 편집 모드에서 토글을 껐으면 null(해제), 새 경기인데 토글 꺼짐이면 undefined(전송 안 함)
      const tournamentTeams: TournamentTeamsPayload | undefined =
        isTournament && tourBlueTeam && tourRedTeam
          ? { blue: tourBlueTeam, red: tourRedTeam }
          : editId ? null : undefined;
      if (editId) {
        await updateMatch(editId, data, tournamentTeams);
      } else {
        await addMatch(data, tournamentTeams);
      }
      router.push('/matches');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('경기 저장 실패:', err);
      setError(`저장 중 오류: ${msg}`);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-5)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--text-strong)', margin: 0 }}>{editId ? '경기 결과 수정' : '경기 결과 입력'}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* 영웅명 자동완성 — 모든 영웅 입력칸이 list="hots-heroes"로 참조 */}
        <datalist id="hots-heroes">
          {KNOWN_HEROES.map(h => <option key={h} value={h} />)}
        </datalist>

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
              <div className="animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}>
                <Image src="/assets/logo-emblem.png" alt="" width={48} height={48} style={{ opacity: 0.85 }} />
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>
                AI가 스크린샷을 분석 중...
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--text-high)' }}>
                경기 결과 스크린샷 AI 분석
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

        {/* AI 분석 완료 후 확인 안내 */}
        {showAiVerifyNotice && (
          <div style={{
            borderRadius: 'var(--r-md)',
            border: '1px solid color-mix(in srgb, var(--tier-b) 55%, var(--border-line))',
            background: 'color-mix(in srgb, var(--tier-b) 12%, var(--surface-card))',
            padding: 'var(--sp-3) var(--sp-4)',
          }}>
            <p style={{
              margin: 0, fontSize: 13, fontFamily: 'var(--font-ui)',
              color: 'var(--tier-b)', fontWeight: 600, lineHeight: 1.5,
            }}>
              ⚠ AI 분석 결과는 부정확할 수 있습니다. 스트리머·영웅·스탯·승리팀을 반드시 직접 확인한 뒤 저장해주세요.
            </p>
          </div>
        )}

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
            <input value={dur} onChange={e => setDur(e.target.value)} placeholder="21:04"
              inputMode="numeric" pattern="\d*:\d*" title="M:SS 또는 MM:SS (예: 21:04)" style={INPUT} />
          </div>
        </div>

        {swapPick && (
          <p style={{ margin: '0 0 var(--sp-2)', fontFamily: 'var(--font-ui)', fontSize: 12,
            color: 'var(--cheese-green)' }}>
            맞바꿀 상대 팀 슬롯의 ⇄ 를 누르세요 (같은 팀을 다시 누르면 선택 이동)
          </p>
        )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* 팀 최종 레벨 */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: 'var(--font-numeral)', fontSize: 11,
                        letterSpacing: '0.06em', color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                      }}>최종 Lv</span>
                      <input
                        value={side === 'blue' ? blueLevel : redLevel}
                        onChange={e => (side === 'blue' ? setBlueLevel : setRedLevel)(e.target.value)}
                        placeholder="—"
                        inputMode="numeric"
                        style={{
                          width: 58, height: 32, padding: '0 8px',
                          borderRadius: 'var(--r-sm)',
                          border: `1.5px solid ${(side === 'blue' ? blueLevel : redLevel) ? accent : 'var(--border-line)'}`,
                          background: 'var(--surface-input)', color: 'var(--text-high)',
                          fontFamily: 'var(--font-numeral)', fontSize: 24,
                          fontWeight: 700, textAlign: 'center', outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                      />
                    </label>
                    <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 11,
                      color: filledCount === 5 ? accent : 'var(--text-faint)' }}>
                      {filledCount} / 5
                    </span>
                  </div>
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
                      swapPicked={swapPick?.side === side && swapPick.i === i}
                      onSwapPick={() => handleSwapPick(side, i)}
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
                  {teamLabel} 승리
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

        {/* ── 선픽 팀 (선택) — 대회 스크림 기록용 ── */}
        <div>
          <label style={LABEL}>선픽 팀 (선택)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
            {([
              { value: '',     label: '모름' },
              { value: 'blue', label: '팀 1이 선픽' },
              { value: 'red',  label: '팀 2가 선픽' },
            ] as { value: '' | 'blue' | 'red'; label: string }[]).map(opt => {
              const active = firstPick === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFirstPick(opt.value)}
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

        {/* ── 대회 경기 태깅 (선택) — 별도 tournamentGames 컬렉션에 기록, 대회 탭 지표 소스 ── */}
        <div>
          <label style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isTournament}
              onChange={e => {
                setIsTournament(e.target.checked);
                if (!e.target.checked) { setTourBlueTeam(''); setTourRedTeam(''); return; }
                // 출전자 소속 다수결로 자동 선택 — 확신 못 하면 비워두고 사람이 고른다
                const guess = guessTournamentTeams(
                  blueSlots.map(s => s.streamerId).filter(Boolean),
                  redSlots.map(s => s.streamerId).filter(Boolean),
                  streamers);
                if (guess) { setTourBlueTeam(guess.blue); setTourRedTeam(guess.red); }
              }}
              style={{ width: 14, height: 14, cursor: 'pointer' }} />
            대회 경기로 기록 (선택)
          </label>
          {isTournament && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginTop: 6 }}>
              <select value={tourBlueTeam} onChange={e => setTourBlueTeam(e.target.value)} style={INPUT}>
                <option value="">팀 1 소속 대회팀</option>
                {TOURNAMENT_TEAMS.map(t => (
                  <option key={t.id} value={t.id} disabled={t.id === tourRedTeam}>{t.name} ({t.captain})</option>
                ))}
              </select>
              <select value={tourRedTeam} onChange={e => setTourRedTeam(e.target.value)} style={INPUT}>
                <option value="">팀 2 소속 대회팀</option>
                {TOURNAMENT_TEAMS.map(t => (
                  <option key={t.id} value={t.id} disabled={t.id === tourBlueTeam}>{t.name} ({t.captain})</option>
                ))}
              </select>
              <span style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-faint)' }}>
                출전자 소속으로 자동 선택됩니다. 용병이 껴서 잘못 잡히면 직접 고르세요.
              </span>
            </div>
          )}
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
            {submitting ? (editId ? '수정 중...' : '저장 중...') : (editId ? '수정' : '저장')}
          </button>
        </div>
      </form>
    </div>
  );
}
