import type { Metadata } from 'next';
import {
  getMatchesWithStatsCachedServer, getStreamersCachedServer, getTournamentGameLinksCachedServer,
} from '@/lib/firestore.server';
import { buildTournamentData, TOURNAMENT_NAME, TOURNAMENT_SEASON } from '@/lib/tournament';
import { buildDemoTournamentData } from '@/lib/tournament-demo';
import TournamentClient from '@/components/tournament-client';

export const metadata: Metadata = {
  title: `${TOURNAMENT_NAME} | CHEESESTORM`,
  description: `${TOURNAMENT_NAME} ${TOURNAMENT_SEASON} — 팀 정보 · 스크림 기록 · 포지션 통계`,
};

export default async function TournamentPage() {
  const [matches, streamers, links] = await Promise.all([
    getMatchesWithStatsCachedServer(),
    getStreamersCachedServer(),
    getTournamentGameLinksCachedServer(),
  ]);
  // 집계는 전부 서버에서 — 클라이언트에는 직렬화된 뷰모델만 전달 (스탯 원본 미전송)
  // 대회 경기는 경기 입력 시 명시적으로 태깅된 것만 채택(links) — 날짜·로스터 추정 없음
  const real = buildTournamentData(matches, links, streamers);
  // 태깅된 실경기가 없는 동안은 더미 미리보기 — 실경기 1건 생기면 자동 전환
  const data = real.games.length > 0 ? real : buildDemoTournamentData(streamers);
  return <TournamentClient data={data} />;
}
