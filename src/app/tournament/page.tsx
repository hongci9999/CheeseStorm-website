import type { Metadata } from 'next';
import {
  getMatchesWithStatsCachedServer, getStreamersCachedServer, getTournamentGameLinksCachedServer,
} from '@/lib/firestore.server';
import {
  buildTournamentData, tournamentDayKeys, TOURNAMENT_NAME, TOURNAMENT_SEASON, TOURNAMENT_TEAMS,
} from '@/lib/tournament';
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
  // 태깅된 경기가 없으면 각 표가 빈 값(—)으로 렌더된다 (더미 미리보기 폐지)
  // 전체 + 일차별 데이터셋을 모두 만들어 넘긴다 — 일차 전환이 클라이언트 상태 변경뿐(재요청 없음).
  // ponytail: 일차 수만큼 뷰모델이 중복 직렬화된다. 대회는 2~3일이라 감수. 늘어나면 일차별 라우트로.
  const days = [
    { key: 'all', label: '전체', data: buildTournamentData(matches, links, streamers) },
    ...tournamentDayKeys(matches, links).map((key, i) => ({
      key, label: `${i + 1}일차`,
      data: buildTournamentData(matches, links, streamers, TOURNAMENT_TEAMS, key),
    })),
  ];
  return <TournamentClient days={days} />;
}
