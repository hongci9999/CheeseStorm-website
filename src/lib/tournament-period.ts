// 대회 진행 기간 — 표시(페이지 부제)와 라우팅(루트 rewrite)에 공용으로 쓰인다.
// Edge 미들웨어에서도 import되므로 무거운 의존성 없이 순수 상수+판정만 둔다.
// (heroes·map-image 등을 끌어오는 tournament.ts와 분리 — 여기서 재-export한다.)

// UTC 자정 기준 날짜 — 표시용 getMonth/getDate가 서버 TZ(UTC)에서도 7.19/7.21로 나오게 유지.
export const TOURNAMENT_START = new Date('2026-07-19');
export const TOURNAMENT_END = new Date('2026-07-21');

// 대회 진행 중 여부 — 종료일(END) 당일 전체를 포함(다음날 0시 전까지).
export function isTournamentActive(now: Date = new Date()): boolean {
  const endInclusive = new Date(TOURNAMENT_END);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1); // 종료일 하루 전체 포함
  return now >= TOURNAMENT_START && now < endInclusive;
}
