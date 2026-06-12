import type { Streamer } from '@/lib/types';

// 판수 다양화: s1(최다) → s14(3판) → s15(2판, unranked)
// s16(막내치즈)은 의도적으로 경기 0판 — 빈 프로필·unranked·롤없음 빈상태 검증용 (matches.ts 생성 대상 아님)
// 롤은 저장하지 않음 — 내전 기록에서 파생 (CONTEXT.md 롤)
// s4(치즈먹자)는 gameNames 2개 — 부캐/별칭 매칭(#8) 검증용
export const MOCK_STREAMERS: Streamer[] = [
  { id: 's1',  name: '폭풍칼날',  chzzkId: 'storm1',  accountLevel: 1247, gameNames: ['Storm#3142'],  profileImageUrl: '/test/image.png', createdAt: new Date('2025-01-01') },
  { id: 's2',  name: '한빛',      chzzkId: 'hanbit',  accountLevel: 982,  gameNames: ['Hanbit#1191'], profileImageUrl: '/test/image.png', createdAt: new Date('2025-01-01') },
  { id: 's3',  name: '강철방패',  chzzkId: 'shield3', accountLevel: 876,                              createdAt: new Date('2025-01-02') },
  { id: 's4',  name: '치즈먹자',                      accountLevel: 654,  gameNames: ['Cheese#5555', '치즈부캐#9090'], createdAt: new Date('2025-01-02') },
  { id: 's5',  name: '달빛소녀',  chzzkId: 'moongl',  accountLevel: 731,                              createdAt: new Date('2025-01-03') },
  { id: 's6',  name: '겐지러버',                      accountLevel: 445,                              createdAt: new Date('2025-01-03') },
  { id: 's7',  name: '조용한자',  chzzkId: 'quiet7',  accountLevel: 512,                              createdAt: new Date('2025-01-04') },
  { id: 's8',  name: '노력파',    chzzkId: 'effort8', accountLevel: 388,                              createdAt: new Date('2025-01-04') },
  { id: 's9',  name: '힘의전사',                      accountLevel: 296,                              createdAt: new Date('2025-01-05') },
  { id: 's10', name: '은신고수',                      accountLevel: 354,  gameNames: ['Ghost#7777'],  createdAt: new Date('2025-01-05') },
  { id: 's11', name: '힐러본능',  chzzkId: 'heal11',  accountLevel: 267,                              createdAt: new Date('2025-01-06') },
  { id: 's12', name: '벼락치기',                      accountLevel: 189,                              createdAt: new Date('2025-01-06') },
  { id: 's13', name: '새내기',                        accountLevel: 87,                               createdAt: new Date('2025-01-07') },
  { id: 's14', name: '주말전사',                      accountLevel: 142,                              createdAt: new Date('2025-01-07') },
  { id: 's15', name: '구경꾼',                        accountLevel: 31,                               createdAt: new Date('2025-01-08') },
  { id: 's16', name: '막내치즈',  chzzkId: 'cheese16', accountLevel: 58,                               createdAt: new Date('2025-01-08') },
];
