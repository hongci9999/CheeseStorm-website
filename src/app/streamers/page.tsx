'use client';

import { useEffect, useState } from 'react';
import { getStreamers, addStreamer, deleteStreamer, isFirebaseConfigured } from '@/lib/firestore';
import type { Streamer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MOCK_STREAMERS } from '@/test/fixtures';

export default function StreamersPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [chzzkId, setChzzkId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!isFirebaseConfigured) {
      setStreamers(MOCK_STREAMERS);
      setLoading(false);
      return;
    }
    const list = await getStreamers();
    setStreamers(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      await addStreamer({ name: name.trim(), chzzkId: chzzkId.trim() || undefined });
      setName('');
      setChzzkId('');
      await load();
    } catch {
      setError('추가 중 오류가 발생했습니다.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(s: Streamer) {
    if (!confirm(`"${s.name}"을(를) 삭제하시겠습니까?\n이 스트리머의 경기 기록에서도 제거됩니다.`)) return;
    await deleteStreamer(s.id);
    setStreamers((prev) => prev.filter((x) => x.id !== s.id));
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">스트리머 관리</h1>

      {/* 추가 폼 */}
      <form onSubmit={handleAdd} className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">새 스트리머 추가</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="스트리머 닉네임"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">치지직 채널 ID (선택)</label>
            <input
              type="text"
              value={chzzkId}
              onChange={(e) => setChzzkId(e.target.value)}
              placeholder="chzzk.naver.com/채널ID"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <Button
          type="submit"
          disabled={adding || !name.trim()}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
        >
          {adding ? '추가 중...' : '추가'}
        </Button>
      </form>

      {/* 목록 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-400">등록된 스트리머 ({streamers.length}명)</h2>
        {loading ? (
          <p className="text-slate-500 text-sm">불러오는 중...</p>
        ) : streamers.length === 0 ? (
          <p className="text-slate-500 text-sm">등록된 스트리머가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {streamers.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-medium text-slate-100">{s.name}</span>
                  {s.chzzkId && (
                    <a
                      href={`https://chzzk.naver.com/${s.chzzkId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      치지직 ↗
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(s)}
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
