// 히어로즈 오브 더 스톰 전장 15종. 앞 6개는 자주 쓰는 전장(1페이지), 나머지는 뒤에.
export const HOTS_MAPS: readonly string[] = [
  '용의 둥지', '저주받은 골짜기', '거미 여왕의 무덤', '불지옥 신단', '파멸의 탑', '영원의 전쟁터',
  '알터랙 고개', '볼스카야 공장', '하나무라 사원', '핵탄두 격전지', '브락시스 항전',
  '하늘 사원', '공포의 정원', '죽음의 광산', '블랙하트 항만',
];

// 시리즈에서 아직 안 쓴 맵만 반환 (맵 중복 금지).
export function availableMaps(usedMaps: string[]): string[] {
  const used = new Set(usedMaps);
  return HOTS_MAPS.filter((m) => !used.has(m));
}
