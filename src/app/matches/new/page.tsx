'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStreamers, addMatch } from '@/lib/firestore';
import type { Streamer } from '@/lib/types';
import { Button } from '@/components/ui/button';

const HOTS_MAPS = [
  '뒤틀린 식물원',
  '공포의 정원',
  '하늘 신전',
  '용의 둥지',
  '공허의 파도',
  '거미 여왕의 무덤',
  '영원의 전쟁터',
  '탑승구 만',
  '불지옥 신단',
  '볼스카야 공장',
  '알터랙 고개',
];

export default function NewMatchPage() {
  const router = useRouter();
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [blueTeam, setBlueTeam] = useState<[string, string][]>([]);
  const [redTeam, setRedTeam] = useState<[string, string][]>([]);
  const [winner, setWinner] = useState<'blue' | 'red'>('blue');
  const [map, setMap] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStreamers().then(setStreamers);
  }, []);

  function togglePlayer(id: string, team: 'blue' | 'red') {
    if (team === 'blue') {
      setBlueTeam((prev) =>
        prev.some(([x]) => x === id) ? prev.filter(([x]) => x !== id) : [...prev, [id, '']]
      );
      setRedTeam((prev) => prev.filter(([x]) => x !== id));
    } else {
      setRedTeam((prev) =>
        prev.some(([x]) => x === id) ? prev.filter(([x]) => x !== id) : [...prev, [id, '']]
      );
      setBlueTeam((prev) => prev.filter(([x]) => x !== id));
    }
  }

  function getPlayerTeam(id: string): 'blue' | 'red' | null {
    if (blueTeam.some(([x]) => x === id)) return 'blue';
    if (redTeam.some(([x]) => x === id)) return 'red';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blueTeam.length === 0 || redTeam.length === 0) {
      setError('블루팀과 레드팀에 최소 1명씩 배정해야 합니다.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await addMatch({
        date: new Date(date),
        blueTeam,
        redTeam,
        winner,
        map: map || undefined,
        note: note || undefined,
      });
      router.push('/matches');
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">경기 결과 입력</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 날짜 & 맵 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">맵 (선택)</label>
            <select
              value={map}
              onChange={(e) => setMap(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">선택 안 함</option>
              {HOTS_MAPS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 팀 배정 */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">팀 배정</label>
          <p className="text-xs text-slate-500">각 스트리머를 블루팀 또는 레드팀에 배정하세요. 한 번 더 클릭하면 해제됩니다.</p>
          {streamers.length === 0 ? (
            <p className="text-slate-400 text-sm">스트리머가 없습니다. 먼저 스트리머를 추가해 주세요.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {streamers.map((s) => {
                const team = getPlayerTeam(s.id);
                return (
                  <div key={s.id} className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => togglePlayer(s.id, 'blue')}
                      className={`flex-1 py-2 rounded-l-md text-xs font-semibold border transition-colors ${
                        team === 'blue'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-blue-600'
                      }`}
                    >
                      {team === 'blue' ? '✓ ' : ''}블루
                    </button>
                    <div className={`flex-[2] flex items-center justify-center py-2 text-xs border-y text-slate-200 truncate px-1 ${
                      team === 'blue' ? 'bg-blue-900/30 border-blue-800' :
                      team === 'red' ? 'bg-red-900/30 border-red-800' :
                      'bg-slate-900 border-slate-700'
                    }`}>
                      {s.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePlayer(s.id, 'red')}
                      className={`flex-1 py-2 rounded-r-md text-xs font-semibold border transition-colors ${
                        team === 'red'
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-red-600'
                      }`}
                    >
                      {team === 'red' ? '✓ ' : ''}레드
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 팀 현황 */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-blue-950/40 border border-blue-900 rounded-lg p-2">
              <div className="text-xs font-semibold text-blue-400 mb-1">블루팀 ({blueTeam.length}명)</div>
              <div className="flex flex-wrap gap-1">
                {blueTeam.map(([id]) => (
                  <span key={id} className="text-xs bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded">
                    {streamers.find((s) => s.id === id)?.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-red-950/40 border border-red-900 rounded-lg p-2">
              <div className="text-xs font-semibold text-red-400 mb-1">레드팀 ({redTeam.length}명)</div>
              <div className="flex flex-wrap gap-1">
                {redTeam.map(([id]) => (
                  <span key={id} className="text-xs bg-red-900/50 text-red-200 px-1.5 py-0.5 rounded">
                    {streamers.find((s) => s.id === id)?.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 승리팀 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">승리팀</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setWinner('blue')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-all ${
                winner === 'blue'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-700'
              }`}
            >
              🏆 블루팀 승리
            </button>
            <button
              type="button"
              onClick={() => setWinner('red')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-all ${
                winner === 'red'
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-red-700'
              }`}
            >
              🏆 레드팀 승리
            </button>
          </div>
        </div>

        {/* 메모 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">메모 (선택)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="경기에 대한 메모를 입력하세요..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold"
          >
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </div>
  );
}
