export type Role = '탱커' | '투사' | '암살자' | '지원가' | '전문가';

// 세분 역할군 — 암살자를 원거리/근접으로 구별 (역할 필터·선호 포지션 표시용).
// 내부 집계(Role)는 5분류 유지, UI 레이어에서만 이 6분류를 사용.
export type FineRole = '탱커' | '투사' | '원거리 암살자' | '근접 암살자' | '지원가' | '전문가';

export interface Streamer {
  id: string;
  name: string;
  chzzkId?: string;
  role?: Role;            // 레거시 필드 — 롤은 내전 기록에서 파생, 더 이상 입력받지 않음
  accountLevel?: number;  // HotS 계정레벨
  gameNames?: string[];   // 인게임 이름(배틀태그) 목록 — OCR 매칭용 (CONTEXT.md 인게임 이름)
  profileImageUrl?: string; // 치지직 프로필 사진. 없으면 닉네임 이니셜로 폴백
  profileImageUpdatedAt?: Date; // 프로필 사진 마지막 갱신 시각 (주기 갱신 TTL 판정용)
  eloRating?: number;     // Elo 레이팅 (최신 값)
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
  firstPick?: 'blue' | 'red';        // 밴픽 선픽 팀 버킷 키 (대회 스크림용, 미지정 = 모름)
  blueLevel?: number;                // 경기 종료 시 blueTeam 버킷의 팀 최종 레벨 (HotS 공유 레벨)
  redLevel?: number;                 // 경기 종료 시 redTeam 버킷의 팀 최종 레벨
  dur?: string;
  note?: string;
  createdAt: Date;
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'unranked';

// 큐레이션 티어 — S~D만 수동 배정, 미배정은 unranked로 표시
export type CuratedTier = Exclude<Tier, 'unranked'>;
export type CuratedPlacements = Record<string, CuratedTier>; // 레거시 마이그레이션용
export type CuratedTierLists = Record<CuratedTier, string[]>; // 티어별 순서 있는 스트리머 ID 목록

// AI OCR 오답 → 정답 매핑 (스트리머 ID / 영웅명). 키는 normalizeOcrKey 적용값.
export interface OcrCorrections {
  streamers: Record<string, string>;
  heroes: Record<string, string>;
}

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
  fineRole?: FineRole;    // 세분 주 역할군 (암살자 원거리/근접 구별) — 역할 필터용
  heroStats: HeroStat[];  // 경기수 내림차순 정렬
  recentWinRate: number;   // 최근 5경기 승률 (5경기 미만이면 전체 승률)
  streak: number;           // 양수=연승, 음수=연패 (예: +3=3연승, -2=2연패, 0=없음)
  topHero?: string;         // 가장 많이 플레이한 영웅 (heroStats[0]?.hero)
  statCoverage?: number;    // 스탯 기록된 경기 비율 (0~1)
  eloRating: number;        // Elo 레이팅 (상대 강도 + 개인 성과 반영)
}
