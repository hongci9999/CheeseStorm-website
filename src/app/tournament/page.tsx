import type { Metadata } from 'next';
import { getMatchesWithStatsCachedServer, getStreamersCachedServer } from '@/lib/firestore.server';
import { buildTournamentData } from '@/lib/tournament';
import TournamentClient from '@/components/tournament-client';

export const metadata: Metadata = {
  title: '대회 | CHEESESTORM',
  description: '스트리머 대회 팀 정보 · 스크림 기록 · 포지션 통계',
};

export default async function TournamentPage() {
  const [matches, streamers] = await Promise.all([
    getMatchesWithStatsCachedServer(),
    getStreamersCachedServer(),
  ]);
  // 집계는 전부 서버에서 — 클라이언트에는 직렬화된 뷰모델만 전달 (스탯 원본 미전송)
  const data = buildTournamentData(matches, streamers);
  return <TournamentClient data={data} />;
}
