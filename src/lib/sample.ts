// 파생 통계의 공통 표본 임계 (CONTEXT.md 데이터 부족)
// 티어 · 맵별 승률 · 시너지/천적 모두 동일하게 최소 3경기를 충족해야 산출한다.
export const MIN_SAMPLE = 3;

// 표본이 임계를 충족하는지 (충족 시 통계 산출, 미만이면 '데이터 부족')
export function hasSufficientSample(games: number): boolean {
  return games >= MIN_SAMPLE;
}

// "값이 0"과 "표본 없음"을 구분하기 위한 공통 표시 라벨
export const INSUFFICIENT_DATA = '데이터 부족';
