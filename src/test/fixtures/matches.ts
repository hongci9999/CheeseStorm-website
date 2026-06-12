import type { Match, PlayerMatchStat } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// 결정적 더미 경기 생성기 (25경기, 5v5)
// 판수 분포: s1 25판(전 경기) ~ s14 3판 · s15 2판(unranked)
// 그리디: 매 경기 남은 목표 판수 상위 10명 선발 → 다양한 판수 보장
// ─────────────────────────────────────────────────────────────

const NUM_MATCHES = 25;

// 스트리머별 목표 판수 (합 = 25경기 × 10슬롯 = 250)
const TARGET_GAMES: Record<string, number> = {
  s1: 25, s2: 24, s3: 23, s4: 22, s5: 21,
  s6: 20, s7: 19, s8: 18, s9: 17, s10: 16,
  s11: 16, s12: 14, s13: 10, s14: 3, s15: 2,
};

// 스트리머별 영웅 풀 — 의도한 주 포지션이 파생되도록 구성
const HERO_POOL: Record<string, string[]> = {
  s1:  ['겐지', '발라', '제이나'],        // 암살자
  s2:  ['루시우', '아나', '우서'],        // 지원가
  s3:  ['가로쉬', '무라딘', '요한나'],    // 탱커
  s4:  ['소냐', '데하카', '임페리우스'],  // 투사
  s5:  ['아바투르', '자가라', '프로비우스'], // 전문가
  s6:  ['리밍', '한조', '겐지'],          // 암살자
  s7:  ['말퓨리온', '리리'],              // 지원가
  s8:  ['디아블로', '아서스'],            // 탱커
  s9:  ['스랄', '레오릭'],                // 투사
  s10: ['노바', '트레이서'],              // 암살자
  s11: ['스투코프', '브라이트윙'],        // 지원가
  s12: ['해머 상사', '머키'],             // 전문가
  s13: ['케리건', '일리단'],              // 암살자
  s14: ['티리엘'],                        // 탱커
  s15: ['라그나로스'],                    // 투사
};

// 맵 5종으로 집중 — 스트리머당 같은 맵 3경기 이상이 충분히 쌓이도록 (맵별 승률 임계 검증용)
const MAPS = [
  '뒤틀린 식물원', '공포의 정원', '하늘 신전', '용의 둥지', '영원의 전쟁터',
];

// 의사난수 없이 결정적 수치 생성용
function det(seed: number, mod: number, base = 0): number {
  return base + ((seed * 7919 + 104729) % mod);
}

function mkStat(seed: number, healer: boolean): PlayerMatchStat {
  return {
    kills: det(seed, 9),
    assists: det(seed + 1, 14, 2),
    deaths: det(seed + 2, 6),
    siegeDmg: det(seed + 3, 40000, 25000),
    heroDmg: det(seed + 4, 30000, 12000),
    healing: healer ? det(seed + 5, 35000, 20000) : 0,
    selfHeal: det(seed + 6, 8000, 1000),
    xp: det(seed + 7, 12000, 9000),
  };
}

const HEALERS = new Set(['루시우', '아나', '우서', '말퓨리온', '리리', '스투코프', '브라이트윙']);

function generate(): Match[] {
  const remaining = new Map(Object.entries(TARGET_GAMES));
  const matches: Match[] = [];

  for (let i = 0; i < NUM_MATCHES; i++) {
    // 남은 목표 상위 10명 (동률은 id 순 — 결정적)
    const picked = Array.from(remaining.entries())
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }))
      .slice(0, 10)
      .map(([id]) => id);
    for (const id of picked) remaining.set(id, remaining.get(id)! - 1);

    // 팀 배정: 경기마다 섞이도록 회전 오프셋 적용
    const rot = i % picked.length;
    const rotated = [...picked.slice(rot), ...picked.slice(0, rot)];
    const blueIds = rotated.slice(0, 5);
    const redIds = rotated.slice(5);

    const heroFor = (id: string) => {
      const pool = HERO_POOL[id];
      return pool[i % pool.length];
    };
    const blueTeam: [string, string][] = blueIds.map(id => [id, heroFor(id)]);
    const redTeam: [string, string][] = redIds.map(id => [id, heroFor(id)]);

    // 날짜: 2025-06-01부터 하루 1~3경기
    const day = Math.floor(i / 2) + 1;
    const date = new Date(`2025-06-${String(day).padStart(2, '0')}T${12 + (i % 2) * 4}:00:00`);

    // 승자: 결정적 패턴 (blue 약 60%)
    const winner: 'blue' | 'red' = det(i, 5) < 3 ? 'blue' : 'red';

    // 스탯: 후반 12경기만 기록 (스크린샷 파싱 도입 후 가정)
    const withStats = i >= NUM_MATCHES - 12;

    matches.push({
      id: `m${i + 1}`,
      date,
      map: MAPS[i % MAPS.length],
      dur: `${det(i, 14, 15)}:${String(det(i + 3, 60)).padStart(2, '0')}`,
      blueTeam,
      redTeam,
      winner,
      ...(withStats && {
        blueStats: blueTeam.map(([, hero], idx) => mkStat(i * 100 + idx, HEALERS.has(hero))),
        redStats: redTeam.map(([, hero], idx) => mkStat(i * 100 + 50 + idx, HEALERS.has(hero))),
      }),
      ...(i === 8 && { note: '역전 경기' }),
      createdAt: date,
    });
  }
  return matches;
}

export const MOCK_MATCHES: Match[] = generate();
