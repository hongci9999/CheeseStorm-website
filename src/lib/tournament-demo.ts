// 대회 페이지 미리보기용 더미 데이터 — DB에 아무것도 쓰지 않는다.
// 실제 분류된 경기가 1건이라도 생기면 page.tsx가 이 데이터를 쓰지 않으므로 자동 소멸.
// 시드 고정 RNG(mulberry32)라 새로고침해도 수치가 흔들리지 않음.
import type { Match, PlayerMatchStat, Streamer } from './types';
import {
  buildTournamentData, TOURNAMENT_TEAMS, TOURNAMENT_MAPS,
  type TournamentData, type TournamentGameLink,
} from './tournament';

// ── 시드 고정 RNG ────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// buildDemoTournamentData 호출마다 리셋 — 호출 순서와 무관하게 항상 같은 결과
let rnd = mulberry32(20260719);
const ri = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

// ── 역할군별 영웅 풀 (heroes.ts 매핑에 존재하는 이름만) ──────
const TANKS    = ['무라딘', '디아블로', '요한나', '가로쉬', 'E.T.C.', '아눕아락', '스티치스'];
const BRUISERS = ['소냐', '아르타니스', '데하카', '임페리우스', '스랄', '레오릭', '바리안'];
const ASSASSINS = ['발라', '제이나', '리밍', '겐지', '그레이메인', '캘타스', '한조', '제라툴', '케리건', '타이커스', '트레이서', '노바'];
const HEALERS  = ['우서', '리리', '레가르', '말퓨리온', '안두인', '루시우', '브라이트윙'];

const MAPS = [...TOURNAMENT_MAPS];

// ── 더미 스트리머 (설정 로스터 이름 그대로) ──────────────────
// 프사는 실제 streamers 컬렉션에서 이름으로 매칭해 그대로 가져온다 —
// 더미 상태에서도 등록된 스트리머는 이니셜 대신 실제 사진으로 보이도록.
function demoStreamers(realStreamers: Streamer[] = []): Streamer[] {
  const realByName = new Map(realStreamers.map((s) => [s.name, s]));
  const names = TOURNAMENT_TEAMS.flatMap((t) => [t.captain, ...t.members]);
  return names.map((name, i) => {
    const real = realByName.get(name);
    return {
      id: `demo-${i}`,
      name,
      gameNames: [`${name}#${1101 + i * 137}`],
      ...(real?.profileImageUrl ? { profileImageUrl: real.profileImageUrl } : {}),
      createdAt: new Date('2026-07-01'),
    };
  });
}

// 슬롯 포지션 규약: [탱커, 투사, 암살자, 암살자, 지원가] — 팀장이 탱커
const SLOT_POOLS = [TANKS, BRUISERS, ASSASSINS, ASSASSINS, HEALERS];

// 역할군별 그럴듯한 스탯 생성
function statFor(slot: number, durMin: number): PlayerMatchStat {
  const scale = durMin / 18; // 기준 18분
  const s = (v: number) => Math.round(v * scale);
  const isTank = slot === 0, isBruiser = slot === 1, isHealer = slot === 4;
  return {
    kills:   isHealer ? ri(0, 3) : isTank ? ri(1, 5) : ri(2, 9),
    assists: ri(5, 16),
    deaths:  ri(1, 6),
    heroDmg: s(isHealer ? ri(8000, 20000) : isTank ? ri(15000, 35000) : isBruiser ? ri(25000, 50000) : ri(35000, 70000)),
    siegeDmg: s(ri(15000, 55000)),
    healing: s(isHealer ? ri(45000, 85000) : ri(0, 6000)),
    selfHeal: s(ri(3000, 15000)),
    xp: s(ri(11000, 21000)),
  };
}

function demoMatches(streamers: Streamer[]): { matches: Match[]; links: TournamentGameLink[] } {
  const byName = new Map(streamers.map((s) => [s.name, s.id]));
  // 팀별 로스터 ID (팀장 먼저 = 탱커 슬롯)
  const rosters = TOURNAMENT_TEAMS.map((t) =>
    [t.captain, ...t.members].map((n) => byName.get(n)!));
  // 팀 강도 — 전적표가 밋밋하지 않게 약간의 편차
  const strength = [0.58, 0.52, 0.48, 0.42];

  const pairings: [number, number][] = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++)
    for (let k = 0; k < 4; k++) pairings.push(k % 2 ? [b, a] : [a, b]);

  const matches: Match[] = [];
  const links: TournamentGameLink[] = [];
  pairings.forEach(([ta, tb], gi) => {
    const durMin = ri(15, 24);
    const dur = `${durMin}:${String(ri(0, 59)).padStart(2, '0')}`;
    // 같은 경기에서 양 팀 영웅 중복 금지 — 슬롯별로 풀에서 2개 뽑아 나눠 가짐
    const side = (roster: string[], taken: Set<string>): [string, string][] =>
      roster.map((id, slot) => {
        let hero = pick(SLOT_POOLS[slot]);
        while (taken.has(hero)) hero = pick(SLOT_POOLS[slot]);
        taken.add(hero);
        return [id, hero];
      });
    const taken = new Set<string>();
    const blueTeam = side(rosters[ta], taken);
    const redTeam = side(rosters[tb], taken);
    const pBlue = strength[ta] / (strength[ta] + strength[tb]);
    const date = new Date(2026, 6, 5 + Math.floor(gi / 2), 19 + (gi % 2) * 2, 0, 0);
    const id = `demo-m${gi}`;
    matches.push({
      id,
      date,
      map: pick(MAPS),
      blueTeam, redTeam,
      blueStats: blueTeam.map((_, i) => statFor(i, durMin)),
      redStats: redTeam.map((_, i) => statFor(i, durMin)),
      winner: rnd() < pBlue ? 'blue' as const : 'red' as const,
      firstPick: rnd() < 0.5 ? 'blue' as const : 'red' as const,
      dur,
      createdAt: date,
    });
    // 실제 운영 방식과 동일하게 명시적 태깅으로 대회 소속을 남긴다.
    links.push({
      matchId: id,
      blueTeamId: TOURNAMENT_TEAMS[ta].id,
      redTeamId: TOURNAMENT_TEAMS[tb].id,
      createdAt: date,
    });
  });
  return { matches, links };
}

export function buildDemoTournamentData(realStreamers: Streamer[] = []): TournamentData {
  rnd = mulberry32(20260719);
  const streamers = demoStreamers(realStreamers);
  const { matches, links } = demoMatches(streamers);
  return { ...buildTournamentData(matches, links, streamers), demo: true };
}
