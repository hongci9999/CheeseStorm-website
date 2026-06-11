export type Role = '탱커' | '투사' | '암살자' | '지원가' | '전문가';

export interface Streamer {
  id: string;
  name: string;
  chzzkId?: string;
  role?: Role;            // 레거시 필드 — 롤은 내전 기록에서 파생, 더 이상 입력받지 않음
  accountLevel?: number;  // HotS 계정레벨
  gameNames?: string[];   // 인게임 이름(배틀태그) 목록 — OCR 매칭용 (CONTEXT.md 인게임 이름)
  createdAt: Date;
}

// 경기 내 개인 스탯 (스크린샷 파싱으로 채워짐)
export interface PlayerMatchStat {
  kills: number;
  assists: number;
  deaths: number;
  siegeDmg: number;
  heroDmg: number;
  healing: number;
  selfHeal: number;
  xp: number;
}

export interface Match {
  id: string;
  date: Date;
  map?: string;
  blueTeam: [string, string][];      // [streamerId, heroName]
  redTeam: [string, string][];       // [streamerId, heroName]
  blueStats?: PlayerMatchStat[];     // blueTeam 인덱스 대응
  redStats?: PlayerMatchStat[];      // redTeam 인덱스 대응
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
