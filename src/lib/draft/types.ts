// 모의 밴픽 도메인 타입.

export type Team = 'blue' | 'red';
export type DraftType = 'normal' | 'soft' | 'hard';

export interface Player {
  id: string;        // DB 스트리머 id, 또는 수동 추가 시 'manual:<uuid>'
  name: string;
  imageUrl?: string; // DB 스트리머면 profileImageUrl
}

// [playerId, 영웅명] 픽 한 건.
export type Pick = [playerId: string, hero: string];

// 완료된 세트 결과.
export interface SetResult {
  map: string;
  firstPick: Team;
  winner: Team;
  bans: Record<Team, string[]>;   // 영웅명
  picks: Record<Team, Pick[]>;
}

// 진행 중 세트 상태.
export interface DraftState {
  map: string;
  firstPick: Team;
  cursor: number;                 // 0..16 (16이면 완료)
  bans: Record<Team, string[]>;
  picks: Record<Team, Pick[]>;
}

// 시리즈 전체 (localStorage에 직렬화되는 루트).
export interface Series {
  draftType: DraftType;
  bestOf: 3 | 5;
  blue: Player[];                 // 길이 5
  red: Player[];                  // 길이 5
  sets: SetResult[];              // 완료된 세트
  current: DraftState | null;     // 진행 중 세트(없으면 세트 셋업 대기)
  autoAssign?: boolean;           // true면 픽을 첫 미배정 플레이어에 자동 배정(스트리머 미지정 빠른 시작)
}

export interface Step {
  kind: 'ban' | 'pick';
  team: Team;
}
