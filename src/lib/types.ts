export interface Streamer {
  id: string;
  name: string;
  chzzkId?: string;
  createdAt: Date;
}

export interface Match {
  id: string;
  date: Date;
  map?: string;
  blueTeam: string[];
  redTeam: string[];
  winner: 'blue' | 'red';
  note?: string;
  createdAt: Date;
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'unranked';

export interface PlayerStats {
  streamerId: string;
  streamerName: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  tier: Tier;
}
