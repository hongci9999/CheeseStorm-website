// 맵(전장) 한글명 → public/maps 이미지 파일명 매핑.
// 파일은 히오스 위키 로딩스크린/아트 이미지를 그대로 사용(파일명 제각각이라 명시 매핑).
const MAP_IMAGE: Record<string, string> = {
  '알터랙 고개': 'Alterac_Pass_Loading_Screen.webp',
  '볼스카야 공장': 'Volskaya_Foundry_loading_screen.webp',
  '하나무라 사원': 'Hanamura_Temple_Loading_Screen.webp',
  '핵탄두 격전지': 'Warhead_Junction.webp',
  '브락시스 항전': 'Braxis_Holdout_Art.webp',
  '파멸의 탑': 'Towers_of_Doom_Art.webp',
  '불지옥 신단': 'Infernal_Shrines.webp',
  '영원의 전쟁터': 'Battlefield_of_Eternity.webp',
  '거미 여왕의 무덤': 'Tomb_of_the_Spider_Queen.webp',
  '하늘 사원': 'Sky_Temple.webp',
  '공포의 정원': 'Garden_of_Terror.webp',
  '죽음의 광산': 'Haunted_Mines.webp',
  '저주받은 골짜기': 'Cursed_Hollow.webp',
  '용의 둥지': 'Dragon_Shire_loading_screen.webp',
  '블랙하트 항만': 'Blackhearts_Bay_Art.webp',
};

// 맵명 → 이미지 URL. 매핑 없으면 null.
export function mapImageUrl(name: string): string | null {
  const file = MAP_IMAGE[name.trim()];
  return file ? `/maps/${file}` : null;
}
