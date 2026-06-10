import { calcPlayerStats } from '@/lib/tier';
import { MOCK_STREAMERS } from './streamers';
import { MOCK_MATCHES } from './matches';

// MOCK_STREAMERS + MOCK_MATCHES 로부터 계산된 PlayerStats
// 테스트/UI 모두에서 import 가능
export const MOCK_STATS = calcPlayerStats(MOCK_STREAMERS, MOCK_MATCHES);
