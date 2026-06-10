'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMatches, getStreamers, deleteMatch } from '@/lib/firestore';
import type { Match, Streamer } from '@/lib/types';
import { Button } from '@/components/ui/button';

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [streamers, setStreamers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    const [matchList, streamerList] = await Promise.all([getMatches(), getStreamers()]);
    setMatches(matchList);
    setStreamers(new Map(streamerList.map((s) => [s.id, s.name])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('이 경기를 삭제하시겠습니까?')) return;
    await deleteMatch(id);
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <div className="text-center text-slate-400 mt-20">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">경기 결과</h1>
        <Link href="/matches/new">
          <Button className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            + 경기 입력
          </Button>
        </Link>
      </div>

      {matches.length === 0 ? (
        <p className="text-slate-400 text-center mt-16">아직 경기 결과가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              getName={(id) => streamers.get(id) ?? id}
              onDelete={() => handleDelete(match.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  getName,
  onDelete,
}: {
  match: Match;
  getName: (id: string) => string;
  onDelete: () => void;
}) {
  const date = match.date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{date}</span>
          {match.map && <span>· {match.map}</span>}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-slate-600 hover:text-red-400 transition-colors"
        >
          삭제
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        {/* 블루팀 */}
        <div className={`space-y-1 ${match.winner === 'blue' ? 'opacity-100' : 'opacity-50'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span className="text-xs font-semibold text-blue-400">
              블루팀 {match.winner === 'blue' && '🏆'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {match.blueTeam.map((id) => (
              <span key={id} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-200">
                {getName(id)}
              </span>
            ))}
          </div>
        </div>

        <span className="text-slate-600 font-bold text-sm">VS</span>

        {/* 레드팀 */}
        <div className={`space-y-1 text-right ${match.winner === 'red' ? 'opacity-100' : 'opacity-50'}`}>
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <span className="text-xs font-semibold text-red-400">
              {match.winner === 'red' && '🏆'} 레드팀
            </span>
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {match.redTeam.map((id) => (
              <span key={id} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-200">
                {getName(id)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {match.note && (
        <p className="mt-3 text-xs text-slate-500 border-t border-slate-800 pt-2">{match.note}</p>
      )}
    </div>
  );
}
