# 모의 밴픽 (Mock Draft) 설계

작성일: 2026-07-05
상태: 승인됨 (구현 대기)

## 목적

치지직 스트리머 HotS 대회를 대비한 **모의 밴픽 시뮬레이터**. 한 명의 운영자가 양 팀을
모두 조작하며, 실제 대회 드래프트 순서·피어리스 규칙을 그대로 재현해 시리즈(Bo3/Bo5)를
연습한다. "어떤 스트리머가 어떤 영웅을 고르는지"가 핵심 관전 포인트라 픽은 항상 특정
플레이어에 묶인다.

## 범위

- 시리즈(여러 세트) 연속 진행. 세트 간 피어리스 상태가 누적된다.
- 저장은 **localStorage** 한 키로만. Firestore 미사용(비용 0), 기기 간 공유·인증 없음.
- 공개 페이지 `/mock-draft`. 인증 불필요(로컬 상태만 다룸).
- 한 운영자가 양 팀을 조작. 실시간 동기화·멀티유저 없음.

## 비범위 (YAGNI)

- 픽 타이머 없음.
- 서버 저장·공유 링크 없음.
- 완성된 시리즈를 `matches` 컬렉션에 기록하지 않음(별개 도구).

## HotS 드래프트 흐름

`F` = 선픽 팀, `S` = 후픽 팀. 먼저 고른 쪽이 우선권(픽 순서 없음).

| 단계 | 순서 | 누적 |
| --- | --- | --- |
| 밴 1 | F, S, F, S | 팀당 밴 2 |
| 픽 1 | F×1, S×2, F×2 | 팀당 픽 F:3 / S:2 |
| 밴 2 | S, F | 팀당 밴 3 |
| 픽 2 | S×2, F×2, S×1 | 팀당 픽 5 |

- 총 16스텝: 밴 6(팀당 3) + 픽 10(팀당 5).
- 밴 2(미드밴)는 다음 픽 차례인 후픽 팀이 먼저 밴한다 — 실제 HotS 드래프트 순서.
  (초기 문서는 F, S로 잘못 기재 — 2026-07-17 스크림 기록 대조로 발견·정정)
- 스텝을 team+kind 시퀀스로 펼치면 (F=선픽 팀 기준):
  `ban:F, ban:S, ban:F, ban:S, pick:F, pick:S, pick:S, pick:F, pick:F, ban:S, ban:F, pick:S, pick:S, pick:F, pick:F, pick:S`

## 드래프트 종류 & 피어리스

세트 종류는 **시리즈 셋업에서 1회 선택**, 전 세트 공통.

전 종류 공통 제약: 이번 세트에 이미 밴/픽된 영웅은 다시 선택 불가.

| 종류 | 추가 잠금 |
| --- | --- |
| 일반 (normal) | 없음 |
| 하드 피어리스 (hard) | 이전 세트에서 **누구든** 픽한 영웅은 전역 밴(다시 픽 불가) |
| 소프트 피어리스 (soft) | **그 픽에 배정되는 플레이어**가 이전 세트에 플레이한 영웅만 잠금. 다른 플레이어·밴은 무제약 |

소프트는 픽 시 플레이어를 먼저 지정해야 하므로, 플레이어 선택 → 그 플레이어의 이전 세트
영웅을 그리드에서 제외하는 방식으로 구현.

## 맵

- 맵 목록: 기존 `HOTS_MAPS` 15종(현재 `src/app/matches/new/page.tsx`에 하드코딩)을
  `src/lib/draft/maps.ts`로 이전하고 matches/new도 이 상수를 재사용.
- 세트 시작 전 맵을 선택한다.
- **맵 중복 금지**: 시리즈 내 이전 세트에서 쓴 맵은 선택 불가(하드 차단).
  `availableMaps(series) = HOTS_MAPS − 사용된 맵`.

## 승자 & 스코어

- 시리즈 셋업에서 **Bo3 / Bo5** 선택.
- 세트 종료 시 운영자가 승자(블루/레드)를 지정. `SetResult.winner`에 저장.
- 상단 스코어보드에 세트 스코어(예: `2 - 1`) 표시. 과반 도달 시 **클린치** 표시(진행은 강제
  종료하지 않음, 연습 목적).
- 승자는 **표시용**. 선픽은 여전히 운영자 수동 지정이며 승자로 자동 결정하지 않는다.

## 아키텍처

**순수 엔진 lib + 얇은 UI**. 드래프트 순서·피어리스·맵 필터 로직은 React와 분리된 순수
함수로 두고 유닛 테스트로 검증. 페이지는 상태 호출과 렌더만 담당.

### 디렉토리

```
src/lib/draft/
├── maps.ts        # HOTS_MAPS 상수 (matches/new에서 이전), availableMaps()
├── types.ts       # Series, Player, SetResult, DraftState, Step 등
├── sequence.ts    # 선픽 팀 → 16스텝 시퀀스 생성
├── engine.ts      # availableHeroes, applyBan, applyPick, undo, isComplete
├── storage.ts     # localStorage 로드/저장 (직렬화)
└── __tests__/
    ├── sequence.test.ts
    └── engine.test.ts

src/app/mock-draft/
└── page.tsx       # 클라이언트 페이지 (셋업 → 세트 루프 UI)

src/components/mock-draft/   # 페이지가 커지면 분리
├── series-setup.tsx     # 종류·Bo·로스터 구성
├── draft-board.tsx      # 팀 슬롯 + 영웅 그리드 + 현재 스텝
├── hero-grid.tsx        # 역할 필터 + 검색 + 영웅 타일
├── scoreboard.tsx       # 세트 스코어 + 클린치
└── pick-history.tsx     # 플레이어별 세트 이력 패널
```

### 데이터 모델

```ts
type Team = 'blue' | 'red';
type DraftType = 'normal' | 'soft' | 'hard';

interface Player {
  id: string;        // DB 스트리머 id, 수동 추가는 'manual:<uuid>'
  name: string;
  imageUrl?: string; // DB 스트리머면 profileImageUrl
}

interface Series {
  draftType: DraftType;
  bestOf: 3 | 5;
  blue: Player[];    // 길이 5
  red: Player[];     // 길이 5
  sets: SetResult[]; // 완료된 세트
  current: DraftState | null; // 진행 중 세트(없으면 셋업 대기)
}

interface SetResult {
  map: string;
  firstPick: Team;
  winner: Team;
  bans: Record<Team, string[]>;                 // 영웅명
  picks: Record<Team, [playerId: string, hero: string][]>;
}

interface DraftState {
  map: string;
  firstPick: Team;
  cursor: number;                               // 0..15, 완료 시 16
  bans: Record<Team, string[]>;
  picks: Record<Team, [string, string][]>;
}

interface Step { kind: 'ban' | 'pick'; team: Team; }
```

### 엔진 API (순수 함수)

```ts
// sequence.ts
buildSequence(firstPick: Team): Step[]         // 길이 16

// engine.ts
startSet(series, map, firstPick): DraftState
currentStep(state): Step | null                // 완료 시 null
isComplete(state): boolean                     // cursor >= 16

// forPlayerId는 소프트 피어리스 필터용(픽 스텝에서 플레이어 지정 시). 밴 스텝이면 무시.
availableHeroes(series, state, forPlayerId?): string[]

applyBan(state, hero): DraftState              // 현재 스텝이 ban일 때
applyPick(state, hero, playerId): DraftState   // 현재 스텝이 pick일 때
undo(state): DraftState                        // 마지막 액션 취소(cursor-1)

finishSet(state, winner): SetResult            // isComplete일 때만

// maps.ts
availableMaps(series): string[]                // HOTS_MAPS − 사용된 맵
```

`availableHeroes` 필터 규칙:
1. 이번 세트 밴/픽된 영웅 제외(항상).
2. 하드: 이전 세트 모든 픽 영웅 제외.
3. 소프트 + 픽 스텝 + `forPlayerId` 주어지면: 그 플레이어가 이전 세트에 픽한 영웅 제외.
4. 별칭 정규화: 영웅 비교는 `heroes.ts`의 표기(trim)를 기준. 그리드는 정규 영웅 목록 사용
   (별칭 중복 제거된 캐노니컬 리스트 — `KNOWN_HEROES`가 별칭을 포함하므로 slug 기준으로
   중복 제거한 목록을 별도 구성).

### UI 흐름

1. **시리즈 셋업**: 드래프트 종류, Bo3/Bo5, 블루·레드 각 5명 로스터.
   - 로스터: DB 스트리머 목록에서 선택 + 수동 이름 입력 추가.
2. **세트 셋업**: 맵 선택(사용된 맵 비활성), 선픽 팀 토글 → 시작.
3. **드래프트 보드**:
   - 중앙: 영웅 그리드(역할 탭 필터 + 이름 검색). 잠긴 영웅은 비활성/흐리게.
   - 현재 스텝 배너: `밴 · 블루` / `픽 · 레드` 등. 픽 스텝이면 팀 내 미배정 플레이어 선택.
   - 좌/우: 블루·레드 팀 — 픽 슬롯 5 + 밴 슬롯 3.
   - 사이드: 플레이어별 세트 이력 패널.
   - `되돌리기` 버튼.
4. **세트 종료**: 승자 지정 → `SetResult` 저장 → 스코어보드 갱신 → 다음 세트 셋업.
5. 매 상태 변화 시 localStorage 저장. 페이지 진입 시 복원. `시리즈 초기화` 버튼 제공.

## 에러 / 엣지 처리

- 로스터가 팀당 5명 미만이면 세트 시작 불가(버튼 비활성 + 안내).
- 사용 가능한 맵이 없으면(15세트 초과, 사실상 불가) 맵 단계 안내.
- 소프트 피어리스에서 특정 플레이어가 픽 가능한 영웅이 0이 되는 극단 상황: 발생 시 그리드
  빈 상태 + 안내(대회 규칙상 실제로 도달 어려움, 강제 해제 안 함).
- localStorage 파싱 실패 시 조용히 초기 상태로 폴백.

## 테스트

엔진 유닛 테스트(Vitest):
- `buildSequence`: 선픽 팀별 16스텝 순서·밴6/픽10 구성 검증.
- `availableHeroes`: 일반/소프트/하드 각각 필터 결과. 소프트는 플레이어별 분리 확인.
- `applyBan/applyPick/undo`: 커서 이동·상태 누적·되돌리기 왕복.
- `availableMaps`: 사용된 맵 제외.
- `finishSet`: isComplete 아닐 때 거부, 승자 반영.

## 재사용 / 기존 코드 영향

- `HOTS_MAPS`를 `src/lib/draft/maps.ts`로 이전, `matches/new/page.tsx`는 import로 교체
  (동작 동일, 단일 출처).
- `heroes.ts`(`KNOWN_HEROES`, 역할 매핑), `hero-image.ts`(`heroImageUrl`) 재사용.
- DB 스트리머 목록은 기존 클라이언트 조회 경로 재사용(로스터 구성용).
- 네비게이션에 `/mock-draft` 진입점 추가(site-header / bottom-tab-bar).

## 코딩 컨벤션

- 코멘트 한국어, 함수·변수 영어 camelCase, 파일 kebab-case.
