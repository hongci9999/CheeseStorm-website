export type Role = '탱커' | '투사' | '암살자' | '지원가' | '전문가';

export interface Streamer {
  id: string;
  name: string;
  chzzkId?: string;
  role?: Role;
  createdAt: Date;
}

export interface Match {
  id: string;
  date: Date;
  map?: string;
  blueTeam: [string, string][];  // [streamerId, heroName]
  redTeam: [string, string][];   // [streamerId, heroName]
  winner: 'blue' | 'red';
  dur?: string;
  note?: string;
  createdAt: Date;
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'unranked';

export interface HeroStat {
  hero: string;
  wins: number;
  losses: number;
}

export interface PlayerStats {
  streamerId: string;
  streamerName: string;
  role?: Role;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  tier: Tier;
  heroStats: HeroStat[];  // 경기수 내림차순 정렬
}
