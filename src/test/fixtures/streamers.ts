import type { Streamer } from '@/lib/types';

export const MOCK_STREAMERS: Streamer[] = [
  { id: 's1', name: '폭풍칼날', role: '암살자',  chzzkId: 'storm1',  createdAt: new Date('2025-01-01') },
  { id: 's2', name: '한빛',     role: '지원가',  chzzkId: 'hanbit',  createdAt: new Date('2025-01-01') },
  { id: 's3', name: '겐지러버', role: '암살자',                      createdAt: new Date('2025-01-02') },
  { id: 's4', name: '달빛소녀', role: '전문가',  chzzkId: 'moongl',  createdAt: new Date('2025-01-02') },
  { id: 's5', name: '치즈먹자', role: '투사',                        createdAt: new Date('2025-01-03') },
  { id: 's6', name: '노력파',   role: '탱커',    chzzkId: 'effort6', createdAt: new Date('2025-01-03') },
  { id: 's7', name: '힘의전사', role: '투사',                        createdAt: new Date('2025-01-04') },
  { id: 's8', name: '조용한자', role: '지원가',  chzzkId: 'quiet8',  createdAt: new Date('2025-01-04') },
  { id: 's9', name: '새내기',                                        createdAt: new Date('2025-01-05') },
  { id: 's10', name: '벼락치기', role: '전문가',                     createdAt: new Date('2025-01-05') },
];
