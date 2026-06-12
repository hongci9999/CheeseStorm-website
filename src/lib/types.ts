export type Role = '탱커' | '투사' | '암살자' | '지원가' | '전문가';

export interface Streamer {
  id: string;
  name: string;
  chzzkId?: string;
  role?: Role;            // 레거시 필드 — 롤은 내전 기록에서 파생, 더 이상 입력받지 않음
  accountLevel?: number;  // HotS 계정레벨
  gameNames?: string[];   // 인게임 이름(배틀태그) 목록 — OCR 매칭용 (CONTEXT.md 인게임 이름)
  profileImageUrl?: string; // 치지직 프로필 사진. 없으면 닉네임 이니셜로 폴백
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
  blueTeam: [string, string][];      // [streamerId, heroName] — '팀 1' 버킷
  redTeam: [string, string][];       // [streamerId, heroName] — '팀 2' 버킷
  blueStats?: PlayerMatchStat[];     // blueTeam 인덱스 대응
  redStats?: PlayerMatchStat[];      // redTeam 인덱스 대응
  winner: 'blue' | 'red';
  leftTeam?: 'blue' | 'red';         // 인게임 좌측 진영 버킷 키 (미지정 = 모름)
  blueLevel?: number;                // 경기 종료 시 blueTeam 버킷의 팀 최종 레벨 (HotS 공유 레벨)
  redLevel?: number;                 // 경기 종료 시 redTeam 버킷의 팀 최종 레벨
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
  profileImageUrl?: string;
  role?: Role;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  tier: Tier;
  heroStats: HeroStat[];  // 경기수 내림차순 정렬
}
