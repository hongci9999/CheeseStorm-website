// 히어로즈 오브 더 스톰 전장 15종 — 최근 출시일 순(최신 → 오래된 순). 단일 출처.
export const HOTS_MAPS: readonly string[] = [
  '알터랙 고개', '볼스카야 공장', '하나무라 사원', '핵탄두 격전지', '브락시스 항전',
  '파멸의 탑', '불지옥 신단', '영원의 전쟁터', '거미 여왕의 무덤', '하늘 사원',
  '공포의 정원', '죽음의 광산', '저주받은 골짜기', '용의 둥지', '블랙하트 항만',
];

// 시리즈에서 아직 안 쓴 맵만 반환 (맵 중복 금지).
export function availableMaps(usedMaps: string[]): string[] {
  const used = new Set(usedMaps);
  return HOTS_MAPS.filter((m) => !used.has(m));
}
