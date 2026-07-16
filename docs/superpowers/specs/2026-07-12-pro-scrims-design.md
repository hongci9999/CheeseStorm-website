# 프로전적 (Pro Scrims) 설계

작성일: 2026-07-12
상태: 승인됨 (구현 대기)

## 목적

프로/외부 팀의 스크림 또는 랭크게임을 관전·기록해, 밴픽 순서·사용 영웅·맵별
밴픽 승률·영웅 승률을 축적하는 통계 도구. 치지직 스트리머 내전 시스템(티어리스트,
`matches`, `streamers`)과는 완전히 분리된 별도 기능이다.

## 범위

- 개별 게임 단위 기록 (시리즈/Bo3·Bo5 개념 없음). 한 게임 = 맵 1개 + 밴픽 16스텝 + 승자.
- 선수 개인 식별 없음. 어느 팀인지만 기록(자유 텍스트 팀명).
- 밴픽은 실제 발생 순서 그대로 저장 (리플레이 가능).
- 통계: 전체 영웅 승률, 맵별 영웅 밴률·픽률·승률, 영웅 상세 페이지.
- 신규 Firestore 컬렉션 `proGames` 사용. 기존 `streamers`/`matches`와 무관.
- 라우트 `/pro-scrims` 하위로 완전 분리. 네비게이션(site-header, bottom-tab-bar)에
  "프로전적" 탭으로 정식 노출.
- 인증·권한은 기존 치지직 OAuth + `requireRole('streamer')` 그대로 재사용
  (streamer 이상만 입력·삭제 가능, 열람은 누구나).

## 비범위 (YAGNI)

- 시리즈/피어리스 드래프트 규칙 없음 (게임 단위이므로 `mock-draft`의 하드/소프트
  피어리스 로직 미재사용).
- 선수별 통계 없음 (선수 식별 자체를 안 함).
- 팀 사전 등록/자동완성 없음 (팀명은 매번 자유 텍스트 입력).
- 입력 중 임시저장(localStorage) 없음 — 저장 전 새로고침하면 처음부터 재입력.
  한 게임 단위라 재입력 부담이 적어 `mock-draft`(시리즈 전체 보존 필요)와 다르게 생략.
- OCR/스크린샷 자동 파싱 없음 (1차: 수동 입력만).

## HotS 드래프트 순서 (재사용)

`src/lib/draft/sequence.ts`의 `buildSequence(firstPick: Team): Step[]`를 그대로
재사용한다 — 밴1(F,S,F,S) → 픽1(F,S,S,F,F) → 밴2(S,F) → 픽2(S,S,F,F,S), 총 16스텝.
밴2(미드밴)는 후픽 팀 먼저 — 초기 문서·구현은 F,S로 잘못 기재돼 있었고 2026-07-17 정정
(구 순서로 저장된 스크림 6건은 scripts/migrate-scrim-midban-swap.mjs로 데이터 정정 완료).
이 파일은 순수 함수이고 세트/피어리스 상태에 의존하지 않아 게임 단위 기록에도
그대로 맞는다.

## 데이터 모델

### Firestore 컬렉션 `proGames`

```ts
interface ProGame {
  id: string;
  date: string;                 // 경기 날짜 (YYYY-MM-DD)
  source: 'scrim' | 'ranked';   // 스크림 / 랭크게임 구분
  map: string;                  // HOTS_MAPS 중 하나
  blueTeam: string;             // 자유 텍스트 팀명
  redTeam: string;              // 자유 텍스트 팀명
  firstPick: 'blue' | 'red';
  winner: 'blue' | 'red';
  sequence: DraftEntry[];       // 길이 16, 실제 발생 순서
  note?: string;
  createdAt: Timestamp;
}

interface DraftEntry {
  kind: 'ban' | 'pick';
  team: 'blue' | 'red';
  hero: string;                 // heroes.ts 표기 기준
}
```

`mock-draft`의 `SetResult`는 밴/픽을 팀별로 묶어 저장해 전체 순서가 소실된다.
이 기능은 "밴픽 순서" 자체가 핵심 요구사항이므로, 16개 항목을 실제 순서 그대로
배열 하나(`sequence`)에 저장해 리플레이 페이지에서 그대로 순회 출력한다.
선수 식별이 없으므로 `mock-draft`의 `Pick`(`[playerId, hero]`) 타입은 쓰지 않고
`{kind, team, hero}` 평면 구조로 둔다.

### 재사용 vs 신규

재사용:
- `src/lib/draft/sequence.ts` — `buildSequence(firstPick)`
- `src/lib/draft/maps.ts` — `HOTS_MAPS` (단, `availableMaps` 맵 중복 제한 로직은
  세트 개념이 없어 미사용)
- `src/lib/heroes.ts` — `KNOWN_HEROES`, 역할 매핑
- `src/lib/hero-image.ts` — `heroImageUrl`
- `src/lib/sample.ts` — `MIN_SAMPLE`, `hasSufficientSample`, `INSUFFICIENT_DATA`
- `src/lib/api-auth.ts` — `requireRole`
- `src/lib/firestore-admin.ts` / `firestore.server.ts` 패턴 (Admin SDK 쓰기,
  `unstable_cache` + `revalidateTag` 읽기)

신규:
```
src/lib/pro-draft/
├── types.ts              # ProGame, DraftEntry
├── entry-engine.ts        # buildSequence 감싸는 얇은 래퍼: applyEntry/undo/isComplete
│                           # (피어리스 없음 — mock-draft/engine.ts보다 훨씬 작음)
├── pro-hero-stats.ts       # proHeroStats(), proHeroStatsByMap()
└── __tests__/
    ├── entry-engine.test.ts
    └── pro-hero-stats.test.ts
```

## API 라우트

기존 `src/app/api/matches/route.ts` 패턴을 그대로 따른다 (Admin SDK 경유,
`requireRole` 가드).

- `GET /api/pro-games` — 목록 조회 (인증 불필요)
- `POST /api/pro-games` — 게임 저장 (`requireRole('streamer')`)
- `GET /api/pro-games/[id]` — 단건 조회 (인증 불필요)
- `DELETE /api/pro-games/[id]` — 삭제 (`requireRole('streamer')`)

저장/삭제 성공 시 `revalidateTag('pro-games')`.

## 페이지 · UI 흐름

### `/pro-scrims` — 통계 홈
- 영웅 전체 승률 테이블(픽률·밴률·승률, 표본 부족 시 `INSUFFICIENT_DATA`)
- 맵 탭 선택 시 해당 맵 기준 밴률·픽률·승률 테이블로 전환
- 영웅 행 클릭 → `/pro-scrims/heroes/[hero]`

### `/pro-scrims/new` — 게임 입력 (streamer 이상)
1. 상단 폼: 날짜, 종류(스크림/랭크), 맵 선택(`HOTS_MAPS`), 블루팀명·레드팀명(자유
   텍스트), 선픽 팀 토글
2. 시작 → `buildSequence(firstPick)`로 16스텝 순차 밴픽 보드 렌더링. 현재 스텝
   배너("밴 · 블루" 등)
3. 영웅 그리드(역할 탭 필터 + 검색) 클릭 → 해당 스텝에 기록. 이번 게임에서 이미
   밴/픽된 영웅은 그리드에서 비활성 (게임 내 중복 방지만 — 이전 게임 참조 없음)
4. `되돌리기` 버튼 — 마지막 항목 취소 (`cursor - 1`)
5. 16스텝 완료 → 승자 선택 → 저장 (`POST /api/pro-games`)

### `/pro-scrims/games` — 게임 목록
날짜·맵·팀명·승자 나열, 클릭 시 상세로 이동.

### `/pro-scrims/games/[id]` — 게임 상세 (밴픽 리플레이)
`sequence` 배열을 순서대로 "1. 밴 · 블루 · OO" 형태로 나열. 승자 표시.

### `/pro-scrims/heroes/[hero]`
해당 영웅의 전체 수치 + 맵별 세부 테이블(`proHeroStatsByMap` 필터).

## 통계 로직

집계는 기존 관례(`hero-stats.ts`, `map-stats.ts`)대로 **사전 저장 없이 실시간
계산**한다 — 데이터량이 적어(수동 입력) 매번 전체 `proGames` 순회로 충분하고,
Firestore Spark 플랜에서 쓰기 비용을 아낀다.

```ts
interface ProHeroStat {
  hero: string;
  games: number;              // 이 영웅이 밴 또는 픽된 게임 수 분모 기준(전체 게임 수)
  picks: number;
  bans: number;
  wins: number;
  losses: number;
  pickRate: number | null;    // picks / games, games < MIN_SAMPLE면 null
  banRate: number | null;     // bans / games
  winRate: number | null;     // wins / picks, picks < MIN_SAMPLE면 null
}

function proHeroStats(games: ProGame[]): ProHeroStat[]
function proHeroStatsByMap(games: ProGame[], map: string): ProHeroStat[]
```

- `MIN_SAMPLE`(5) 미만이면 해당 비율은 `null` → UI에서 `INSUFFICIENT_DATA` 표시.
  픽률·밴률은 전체 게임 수 기준, 승률은 픽된 게임 수 기준으로 별도 판정.
- 서버 컴포넌트 캐싱: `getProGamesCachedServer()` (`unstable_cache`, tag
  `pro-games`) — `firestore.server.ts` 패턴 그대로.

## 에러 / 엣지 처리

- 그리드에서 선택 가능한 영웅이 0이 되는 경우는 사실상 없음(HotS 영웅 90종+,
  게임당 16개만 소모).
- 입력 중 새로고침 시 임시 저장 없이 소실 — 의도된 단순화(YAGNI, 위 비범위 참고).
- 저장 실패 시 기존 `matches` 저장 에러 토스트 패턴 재사용.

## 테스트 (Vitest)

- `entry-engine.test.ts`: 16스텝 순서 강제, 게임 내 중복 선택 차단, undo 왕복.
- `pro-hero-stats.test.ts`: 픽률·밴률·승률 계산, `MIN_SAMPLE` 미만 null 처리,
  맵 필터링.

## 재사용 / 기존 코드 영향

- `src/lib/draft/sequence.ts`, `maps.ts`, `heroes.ts`, `hero-image.ts`,
  `sample.ts`, `api-auth.ts` — 수정 없이 import만.
- `site-header.tsx`, `bottom-tab-bar.tsx`에 "프로전적" 탭 추가.
- 기존 `matches`/`streamers`/`mock-draft` 코드·데이터에 영향 없음 (완전 분리
  컬렉션·라우트).

## 코딩 컨벤션

코멘트 한국어, 함수·변수 영어 camelCase, 파일 kebab-case, Next.js 페이지는
`page.tsx` 고정.
