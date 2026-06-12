import type { Match, PlayerMatchStat } from './types';
import { heroOf, outcomeFor, statOf } from './match';

// 영웅별 집계 결과 타입
export interface HeroAggregate {
  hero: string;
  games: number;       // 전체 판수
  wins: number;
  losses: number;
  winRate: number | null; // games > 0이면 계산, 아니면 null
  // 스탯 기록된 경기만 평균
  statGames: number;   // 스탯 있는 판수
  avgKda: number | null;       // (킬+어시) / max(1, 데스), statGames > 0일 때만
  avgHeroDmg: number | null;
  avgSiegeDmg: number | null;
  avgHealing: number | null;
  avgSelfHeal: number | null;
  avgXp: number | null;
}

// 스탯 집계 누산용 내부 타입
interface StatAccum {
  kills: number;
  assists: number;
  deaths: number;
  heroDmg: number;
  siegeDmg: number;
  healing: number;
  selfHeal: number;
  xp: number;
  count: number;
}

function emptyAccum(): StatAccum {
  return { kills: 0, assists: 0, deaths: 0, heroDmg: 0, siegeDmg: 0, healing: 0, selfHeal: 0, xp: 0, count: 0 };
}

function addStat(acc: StatAccum, s: PlayerMatchStat): void {
  acc.kills    += s.kills;
  acc.assists  += s.assists;
  acc.deaths   += s.deaths;
  acc.heroDmg  += s.heroDmg;
  acc.siegeDmg += s.siegeDmg;
  acc.healing  += s.healing;
  acc.selfHeal += s.selfHeal;
  acc.xp       += s.xp;
  acc.count    += 1;
}

function avgOrNull(total: number, count: number): number | null {
  return count > 0 ? Math.round(total / count) : null;
}

/**
 * 특정 스트리머가 사용한 모든 영웅의 집계를 계산한다.
 * - 스탯 없는 경기도 승패/판수에 포함
 * - 평균 스탯은 스탯이 기록된 경기만 집계
 * - 반환: 판수 내림차순, 동률이면 영웅명 사전순
 */
export function aggregateHeroStats(
  streamerId: string,
  matches: Match[],
): HeroAggregate[] {
  // 영웅 → 승패/스탯 누산
  const heroMap = new Map<string, { wins: number; losses: number; stat: StatAccum }>();

  for (const m of matches) {
    const hero = heroOf(m, streamerId);
    if (!hero) continue; // 이 경기에 참가하지 않음

    const outcome = outcomeFor(m, streamerId);
    if (!outcome) continue;

    if (!heroMap.has(hero)) {
      heroMap.set(hero, { wins: 0, losses: 0, stat: emptyAccum() });
    }
    const entry = heroMap.get(hero)!;

    if (outcome === 'win') entry.wins++;
    else entry.losses++;

    const stat = statOf(m, streamerId);
    if (stat) addStat(entry.stat, stat);
  }

  // Map → HeroAggregate 변환
  const result: HeroAggregate[] = [];
  for (const [hero, { wins, losses, stat }] of heroMap) {
    const games = wins + losses;
    const sc = stat.count;
    result.push({
      hero,
      games,
      wins,
      losses,
      winRate: games > 0 ? wins / games : null,
      statGames: sc,
      avgKda:      sc > 0 ? Math.round(((stat.kills + stat.assists) / Math.max(1, stat.deaths)) * 100) / 100 : null,
      avgHeroDmg:  avgOrNull(stat.heroDmg,  sc),
      avgSiegeDmg: avgOrNull(stat.siegeDmg, sc),
      avgHealing:  avgOrNull(stat.healing,  sc),
      avgSelfHeal: avgOrNull(stat.selfHeal, sc),
      avgXp:       avgOrNull(stat.xp,       sc),
    });
  }

  // 판수 내림차순, 동률이면 영웅명 사전순
  result.sort((a, b) => b.games - a.games || a.hero.localeCompare(b.hero, 'ko'));
  return result;
}
