'use client';

import { useEffect, useState } from 'react';
import { getStreamers, getMatches } from '@/lib/firestore';
import { calcPlayerStats, TIER_COLORS, TIER_LABELS } from '@/lib/tier';
import type { PlayerStats, Tier } from '@/lib/types';

const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [streamers, matches] = await Promise.all([getStreamers(), getMatches()]);
      setStats(calcPlayerStats(streamers, matches));
      setLoading(false);
    }
    load();
  }, []);

  const grouped = TIERS.reduce<Record<Tier, PlayerStats[]>>(
    (acc, tier) => {
      acc[tier] = stats.filter((s) => s.tier === tier);
      return acc;
    },
    { S: [], A: [], B: [], C: [], D: [], unranked: [] }
  );
  const unranked = stats.filter((s) => s.tier === 'unranked');

  if (loading) {
    return <div className="text-center text-slate-400 mt-20">불러오는 중...</div>;
  }

  if (stats.length === 0) {
    return (
      <div className="text-center text-slate-400 mt-20">
        <p className="text-2xl mb-2">아직 데이터가 없습니다</p>
        <p className="text-sm">스트리머를 추가하고 경기 결과를 입력해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">티어리스트</h1>
      <p className="text-xs text-slate-500">승률 기준 · 최소 3경기 이상 시 티어 부여</p>

      <div className="space-y-3">
        {TIERS.map((tier) => {
          const players = grouped[tier];
          if (players.length === 0) return null;
          return (
            <div key={tier} className="flex gap-3 items-stretch">
              <div
                className={`w-14 shrink-0 flex items-center justify-center rounded-lg text-3xl font-black ${TIER_COLORS[tier]}`}
              >
                {TIER_LABELS[tier]}
              </div>
              <div className="flex-1 bg-slate-900 rounded-lg p-3 flex flex-wrap gap-2">
                {players.map((p) => (
                  <PlayerChip key={p.streamerId} stat={p} />
                ))}
              </div>
            </div>
          );
        })}

        {unranked.length > 0 && (
          <div className="flex gap-3 items-stretch">
            <div className="w-14 shrink-0 flex items-center justify-center rounded-lg text-xl font-black bg-slate-700 text-slate-400">
              ?
            </div>
            <div className="flex-1 bg-slate-900 rounded-lg p-3 flex flex-wrap gap-2">
              {unranked.map((p) => (
                <PlayerChip key={p.streamerId} stat={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerChip({ stat }: { stat: PlayerStats }) {
  const pct = stat.totalGames > 0 ? Math.round(stat.winRate * 100) : 0;
  return (
    <div className="bg-slate-800 rounded-md px-3 py-2 flex flex-col items-center min-w-[80px]">
      <span className="font-semibold text-sm text-slate-100">{stat.streamerName}</span>
      <span className="text-xs text-slate-400 mt-0.5">
        {stat.wins}W {stat.losses}L
      </span>
      {stat.totalGames > 0 && (
        <span className={`text-xs mt-0.5 font-medium ${pct >= 50 ? 'text-blue-400' : 'text-red-400'}`}>
          {pct}%
        </span>
      )}
    </div>
  );
}
