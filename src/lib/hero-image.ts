// 영웅명(데이터 표기·별칭) → 공식 영문 slug. 영웅 프로필 이미지 파일명에 사용.
// 파일 위치: public/heroes/<slug>.webp  (예: /heroes/genji.webp)
// 별칭(OCR 표기 변형·구명칭)도 같은 slug로 매핑 — heroes.ts HERO_ROLES 키와 정합.
const HERO_SLUG: Record<string, string> = {
  // ── 전사(탱커) ──
  '가로쉬': 'garrosh', '누더기': 'stitches', '스티치스': 'stitches',
  '디아블로': 'diablo', '말가니스': 'malganis', '메이': 'mei', '무라딘': 'muradin',
  '블레이즈': 'blaze', '아눕아락': 'anubarak', '아서스': 'arthas', '요한나': 'johanna',
  '정예 타우렌 족장': 'etc', 'E.T.C.': 'etc', 'ETC': 'etc', '초': 'cho', '티리엘': 'tyrael',

  // ── 투사 ──
  '가즈로': 'gazlowe', '데스윙': 'deathwing', '데하카': 'dehaka',
  '들창코': 'hogger', '호거': 'hogger', '라그나로스': 'ragnaros', '레오릭': 'leoric',
  '렉사르': 'rexxar', '말티엘': 'malthael', '바리안': 'varian', '소냐': 'sonya',
  '스랄': 'thrall', '아르타니스': 'artanis', '이렐': 'yrel', '임페리우스': 'imperius',
  '줄': 'xul', '첸': 'chen', 'D.Va': 'dva', '디바': 'dva',

  // ── 원거리 암살자 ──
  '갈': 'gall', '겐지': 'genji', '굴단': 'guldan', '그레이메인': 'graymane',
  '나지보': 'nazeebo', '노바': 'nova', '레이너': 'rayner', '루나라': 'lunara',
  '리밍': 'liming', '메피스토': 'mephisto', '발라': 'valla', '실바나스': 'sylvanas',
  '아즈모단': 'azmodan', '오르피아': 'orphea', '자가라': 'zagara', '정크랫': 'junkrat',
  '제이나': 'jaina', '줄진': 'zuljin', '카시아': 'cassia', '캐시아': 'cassia',
  '캘타스': 'kaelthas', '켈투자드': 'kelthuzad', '크로미': 'chromie', '타이커스': 'tychus',
  '태사다르': 'tassadar', '타사다르': 'tassadar', '트레이서': 'tracer', '폴스타트': 'falstad',
  '프로비우스': 'probius', '피닉스': 'fenix', '펜릭스': 'fenix', '한조': 'hanzo',
  '해머 상사': 'sgthammer', '해머상사': 'sgthammer',

  // ── 근접 암살자 ──
  '도살자': 'thebutcher', '부처': 'thebutcher', '더 부처': 'thebutcher',
  '마이에브': 'maiev', '머키': 'murky', '발리라': 'valeera', '사무로': 'samuro',
  '알라라크': 'alarak', '일리단': 'illidan', '제라툴': 'zeratul', '케리건': 'kerrigan',
  '키히라': 'qhira',

  // ── 치유사(지원가) ──
  '데커드': 'deckard', '레가르': 'rehgar', '루시우': 'lucio', '리리': 'lili',
  '말퓨리온': 'malfurion', '모랄레스 중위': 'ltmorales', '빛나래': 'brightwing',
  '브라이트윙': 'brightwing', '스투코프': 'stukov', '스터코프': 'stukov', '아나': 'ana',
  '아우리엘': 'auriel', '안두인': 'anduin', '알렉스트라자': 'alexstrasza', '우서': 'uther',
  '카라짐': 'kharazim', '티란데': 'tyrande', '화이트메인': 'whitemane', '휘트메인': 'whitemane',

  // ── 전문가(지원) ──
  '길 잃은 바이킹': 'thelostvikings', '잃어버린 바이킹': 'thelostvikings',
  '더 로스트 바이킹': 'thelostvikings', '메디브': 'medivh', '아바투르': 'abathur',
  '자리야': 'zarya',
};

// 영웅명 → 이미지 URL. 매핑 없으면 undefined (HexAvatar가 이니셜로 폴백).
export function heroImageUrl(hero: string): string | undefined {
  const slug = HERO_SLUG[hero.trim()];
  return slug ? `/heroes/${slug}.webp` : undefined;
}

// 알려진 slug 전체 (다운로드 스크립트·검증용). 중복 제거.
export const HERO_SLUGS: string[] = Array.from(new Set(Object.values(HERO_SLUG)));
