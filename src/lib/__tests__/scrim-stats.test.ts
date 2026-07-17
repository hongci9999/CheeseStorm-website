import { describe, it, expect } from 'vitest';
import {
  heroScrimStats, mapScrimStats, firstPickSummary,
  synergyPairs, counterPairs, roleCompStats, distinctPatches,
  firstPickHeroStats, openBanHeroStats,
} from '../scrim-stats';
import type { Scrim } from '../scrim';

// 실제 영웅명 사용 — roleCompStats가 roleOfHero 매핑을 타기 때문.
function scrim(over: Partial<Scrim>): Scrim {
  return {
    id: 'x', date: new Date('2026-07-16'), map: '용의 둥지', winner: 'blue',
    bans: { blue: ['겐지', '트레이서', '초갈밴'], red: ['말퓨리온', '데커드', '아눕아락'] },
    picks: {
      blue: ['무라딘', '소냐', '발라', '제이나', '우서'],
      red: ['디아블로', '데하카', '리밍', '노바', '레가르'],
    },
    createdAt: new Date('2026-07-16T10:00:00'),
    ...over,
  };
}

// 게임1: blue 승, 게임2: red 승 (같은 밴픽), 게임3: 다른 맵·패치, blue 승
const g1 = scrim({ id: 'a', patch: '2.55.16' });
const g2 = scrim({ id: 'b', winner: 'red', patch: '2.55.16' });
const g3 = scrim({ id: 'c', map: '하늘 사원', patch: '2.55.8' });
const all = [g1, g2, g3];

describe('heroScrimStats', () => {
  const stats = heroScrimStats(all);
  const of = (h: string) => stats.find((s) => s.hero === h)!;

  it('밴·픽 횟수와 페이즈 분류', () => {
    // 겐지 = blue 1번째 밴 → 전역 0(오프닝), 3경기 전부
    expect(of('겐지')).toMatchObject({ bans: 3, openBans: 3, midBans: 0, picks: 0 });
    // 초갈밴 = blue 3번째 밴 → 전역 9(미드밴)
    expect(of('초갈밴')).toMatchObject({ bans: 3, openBans: 0, midBans: 3 });
  });

  it('픽 승률 — 픽한 팀 기준', () => {
    // 무라딘: blue 픽 3회, blue 승 2회
    expect(of('무라딘')).toMatchObject({ picks: 3, pickWins: 2 });
    expect(of('무라딘').pickWinRate).toBeCloseTo(2 / 3);
    // 디아블로: red 픽 3회, red 승 1회
    expect(of('디아블로').pickWinRate).toBeCloseTo(1 / 3);
  });

  it('평균 픽 순번 — 전역 1~10', () => {
    // 무라딘 = blue 첫 픽 = 전역 픽 1번
    expect(of('무라딘').avgPickOrder).toBe(1);
    // 레가르 = red 마지막 픽 = 전역 픽 10번
    expect(of('레가르').avgPickOrder).toBe(10);
  });

  it('관여율·열리면 픽률', () => {
    expect(of('겐지').presenceRate).toBe(1);       // 3경기 전부 밴
    expect(of('겐지').openPickRate).toBe(0);       // 열린 경기 없음
    expect(of('무라딘').openPickRate).toBe(1);     // 3경기 모두 열렸고 모두 픽
  });
});

describe('맵·선픽 통계', () => {
  it('맵별 선픽팀 승률', () => {
    const maps = mapScrimStats(all);
    expect(maps[0]).toMatchObject({ map: '용의 둥지', games: 2, firstPickWins: 1 });
    expect(maps[1]).toMatchObject({ map: '하늘 사원', games: 1, firstPickWins: 1 });
  });

  it('전체 선픽팀 승률', () => {
    expect(firstPickSummary(all)).toEqual({ games: 3, firstPickWins: 2, firstPickWinRate: 2 / 3 });
  });
});

describe('조합 통계', () => {
  it('시너지 — 같은 팀 2영웅, 최소 표본 필터', () => {
    const pairs = synergyPairs(all, 3);
    const muradinSonya = pairs.find((p) => [p.a, p.b].includes('무라딘') && [p.a, p.b].includes('소냐'))!;
    expect(muradinSonya).toMatchObject({ games: 3, wins: 2 });
    expect(synergyPairs(all, 4)).toHaveLength(0); // 표본 4 미만 전부 컷
  });

  it('카운터 — 승률 높은 쪽이 a', () => {
    const pairs = counterPairs(all, 3);
    const p = pairs.find((x) => [x.a, x.b].includes('무라딘') && [x.a, x.b].includes('디아블로'))!;
    // 무라딘(blue) 2승 1패 → a=무라딘
    expect(p.a).toBe('무라딘');
    expect(p.winRate).toBeCloseTo(2 / 3);
  });
});

describe('역할군 조합', () => {
  it('팀 단위 표본 — 경기당 2', () => {
    const comps = roleCompStats(all);
    expect(comps.reduce((sum, c) => sum + c.games, 0)).toBe(6);
    // blue 픽 = 탱1(무라딘)·투1(소냐)·암2(발라·제이나)·힐1(우서)
    const blueComp = comps.find((c) => c.comp === '탱커1·투사1·암살자2·지원가1')!;
    expect(blueComp.games).toBeGreaterThanOrEqual(3);
  });
});

describe('firstPickHeroStats', () => {
  it('선픽팀 첫 픽 횟수·승률', () => {
    const [top] = firstPickHeroStats(all);
    expect(top).toMatchObject({ hero: '무라딘', picks: 3, wins: 2 });
    expect(top.winRate).toBeCloseTo(2 / 3);
  });
});

describe('openBanHeroStats', () => {
  it('오프닝 밴 4개만 집계 — 순번·주체 팀', () => {
    const stats = openBanHeroStats(all);
    const of = (h: string) => stats.find((s) => s.hero === h)!;
    // 겐지 = blue 1밴 → 전역 1, 선픽팀 컷
    expect(of('겐지')).toMatchObject({ bans: 3, byFirstPick: 3, avgBanOrder: 1 });
    // 데커드 = red 2밴 → 전역 4, 후픽팀 컷
    expect(of('데커드')).toMatchObject({ bans: 3, byFirstPick: 0, avgBanOrder: 4 });
    // 미드밴(초갈밴·아눕아락)은 미포함
    expect(stats.map((s) => s.hero).sort()).toEqual(['겐지', '데커드', '말퓨리온', '트레이서']);
  });

  it('정렬 — 횟수 desc, 동률이면 순번 asc', () => {
    const stats = openBanHeroStats(all);
    expect(stats[0].hero).toBe('겐지'); // 전부 3회 → 평균 순번 1이 최상단
  });
});

describe('distinctPatches', () => {
  it('중복 제거 + 최신 우선', () => {
    expect(distinctPatches(all)).toEqual(['2.55.16', '2.55.8']);
  });
});
