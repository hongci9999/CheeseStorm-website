import type { Match, Role, FineRole } from './types';
import { heroOf } from './match';

// HotS 영웅 → 역할군 (구 5분류: 탱커/투사/암살자/지원가/전문가)
// OCR 표기 변형은 별칭으로 추가. 모르는 영웅은 roleOfHero가 null 반환.
const HERO_ROLES: Record<string, Role> = {
  // ── 탱커 ──
  '아눕아락': '탱커', '아서스': '탱커', '블레이즈': '탱커', '디아블로': '탱커',
  '가로쉬': '탱커', '요한나': '탱커', '말가니스': '탱커', '메이': '탱커',
  '무라딘': '탱커', '스티치스': '탱커', '누더기': '탱커', '티리엘': '탱커',
  '정예 타우렌 족장': '탱커', 'E.T.C.': '탱커', 'ETC': '탱커', '초': '탱커',

  // ── 투사 ──
  '아르타니스': '투사', '첸': '투사', '데하카': '투사', '디바': '투사', 'D.Va': '투사',
  '임페리우스': '투사', '레오릭': '투사', '말티엘': '투사', '라그나로스': '투사',
  '소냐': '투사', '스랄': '투사', '이렐': '투사', '렉사르': '투사', '호거': '투사', '들창코': '투사',
  '데스윙': '투사', '바리안': '투사', '가즈로': '투사', '줄': '투사',

  // ── 암살자 ──
  // 원거리
  '갈': '암살자', '겐지': '암살자', '굴단': '암살자', '그레이메인': '암살자',
  '나지보': '암살자', '노바': '암살자', '레이너': '암살자', '루나라': '암살자',
  '리밍': '암살자', '메피스토': '암살자', '발라': '암살자', '실바나스': '암살자',
  '아즈모단': '암살자', '오르피아': '암살자', '자가라': '암살자', '정크랫': '암살자',
  '제이나': '암살자', '줄진': '암살자', '카시아': '암살자', '캐시아': '암살자',
  '캘타스': '암살자', '켈투자드': '암살자', '크로미': '암살자', '타이커스': '암살자',
  '타사다르': '암살자', '태사다르': '암살자', '트레이서': '암살자', '폴스타트': '암살자',
  '프로비우스': '암살자', '펜릭스': '암살자', '피닉스': '암살자', '한조': '암살자',
  '해머 상사': '암살자', '해머상사': '암살자',
  // 근접
  '도살자': '암살자', '부처': '암살자', '더 부처': '암살자',
  '마이에브': '암살자', '머키': '암살자', '발리라': '암살자', '사무로': '암살자',
  '알라라크': '암살자', '일리단': '암살자', '제라툴': '암살자', '케리건': '암살자', '키히라': '암살자',

  // ── 지원가 ──
  '알렉스트라자': '지원가', '아나': '지원가', '안두인': '지원가', '아우리엘': '지원가',
  '브라이트윙': '지원가', '빛나래': '지원가', '데커드': '지원가', '카라짐': '지원가', '리리': '지원가',
  '루시우': '지원가', '말퓨리온': '지원가', '모랄레스 중위': '지원가', '레가르': '지원가',
  '스투코프': '지원가', '스터코프': '지원가', '티란데': '지원가', '우서': '지원가',
  '휘트메인': '지원가', '화이트메인': '지원가',

  // ── 전문가 ──
  '아바투르': '전문가', '메디브': '전문가', '자리야': '전문가',
  '잃어버린 바이킹': '전문가', '더 로스트 바이킹': '전문가', '길 잃은 바이킹': '전문가',
};

// 영웅명 → 역할군. 모르는 영웅은 null.
export function roleOfHero(hero: string): Role | null {
  return HERO_ROLES[hero.trim()] ?? null;
}

// 근접(밀리) 암살자 집합. 나머지 암살자는 원거리로 분류. (출처: HotS 공식 역할군)
const MELEE_ASSASSINS = new Set([
  '도살자', '부처', '더 부처', '마이에브', '머키', '발리라', '사무로',
  '알라라크', '일리단', '제라툴', '케리건', '키히라',
]);

// 영웅명 → 세분 역할군. 암살자는 원거리/근접으로 구별, 나머지는 Role 그대로. 모르면 null.
export function fineRoleOfHero(hero: string): FineRole | null {
  const role = roleOfHero(hero);
  if (role === null) return null;
  if (role === '암살자') {
    return MELEE_ASSASSINS.has(hero.trim()) ? '근접 암살자' : '원거리 암살자';
  }
  return role;
}

// 영웅명이 알려진 영웅인지 (역할군 매핑 존재 여부). OCR 오타·신규 영웅 검출용.
export function isKnownHero(hero: string): boolean {
  return roleOfHero(hero) !== null;
}

// 자동완성 제안용 영웅명 목록 (별칭 포함, 가나다순).
export const KNOWN_HEROES: string[] = Object.keys(HERO_ROLES).sort((a, b) => a.localeCompare(b, 'ko'));

// 역할군별 플레이 분포 (판수 내림차순). pct는 정수 반올림.
export function roleAffinity(
  matches: Match[],
  streamerId: string,
): { role: Role; games: number; pct: number }[] {
  const counts = new Map<Role, number>();
  let total = 0;
  for (const m of matches) {
    const hero = heroOf(m, streamerId);
    if (!hero) continue;
    const role = roleOfHero(hero);
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
    total++;
  }
  return Array.from(counts.entries())
    .map(([role, games]) => ({ role, games, pct: Math.round((games / total) * 100) }))
    .sort((a, b) => b.games - a.games);
}

// 내전 기록에서 스트리머의 롤 파생: 가장 많이 플레이한 역할군.
// 동률이면 최근 경기의 역할군 우선.
// alreadySortedDesc=true 이면 내부 정렬을 생략 (호출자가 이미 내림차순 정렬해서 넘긴 경우).
export function deriveRole(matches: Match[], streamerId: string, alreadySortedDesc = false): Role | undefined {
  const recentFirst = alreadySortedDesc ? matches : [...matches].sort((a, b) => b.date.getTime() - a.date.getTime());
  // Map 삽입 순서 = 최근 경기 순 → 동률 시 먼저 삽입된(최근) 역할이 이김
  const counts = new Map<Role, number>();
  for (const m of recentFirst) {
    const hero = heroOf(m, streamerId);
    if (!hero) continue;
    const role = roleOfHero(hero);
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  let best: Role | undefined;
  let max = 0;
  for (const [role, n] of counts) {
    if (n > max) { best = role; max = n; }
  }
  return best;
}

// 세분 역할군(암살자 원거리/근접 구별) 분포 — roleAffinity의 fine 버전. UI 표시용.
export function fineRoleAffinity(
  matches: Match[],
  streamerId: string,
): { role: FineRole; games: number; pct: number }[] {
  const counts = new Map<FineRole, number>();
  let total = 0;
  for (const m of matches) {
    const hero = heroOf(m, streamerId);
    if (!hero) continue;
    const role = fineRoleOfHero(hero);
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
    total++;
  }
  return Array.from(counts.entries())
    .map(([role, games]) => ({ role, games, pct: Math.round((games / total) * 100) }))
    .sort((a, b) => b.games - a.games);
}

// 세분 주 역할군 파생 — deriveRole의 fine 버전. 동률이면 최근 경기 우선.
// alreadySortedDesc=true 이면 내부 정렬 생략.
export function deriveFineRole(matches: Match[], streamerId: string, alreadySortedDesc = false): FineRole | undefined {
  const recentFirst = alreadySortedDesc ? matches : [...matches].sort((a, b) => b.date.getTime() - a.date.getTime());
  const counts = new Map<FineRole, number>();
  for (const m of recentFirst) {
    const hero = heroOf(m, streamerId);
    if (!hero) continue;
    const role = fineRoleOfHero(hero);
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  let best: FineRole | undefined;
  let max = 0;
  for (const [role, n] of counts) {
    if (n > max) { best = role; max = n; }
  }
  return best;
}
