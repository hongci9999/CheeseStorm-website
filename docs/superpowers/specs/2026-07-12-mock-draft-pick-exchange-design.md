# 모의 밴픽 — 픽 중 스트리머 선택 제거 + 픽 교환으로 최종 배정

작성일: 2026-07-12
상태: 승인됨 (구현 대기)

## 목적

현재 `mock-draft` 드래프트는 픽 스텝마다 "어느 스트리머가 이 영웅을 픽하는지"를
매번 골라야 한다(자동 배정 모드 제외). 실제 밴픽 진행 흐름과 안 맞고 번거롭다.
픽 스텝에서는 영웅만 고르고, 드래프트가 끝난 뒤 팀 내에서 "픽 교환"으로 누가
어떤 영웅을 쓸지 한 번에 정하는 방식으로 바꾼다.

## 범위

- 대상: `src/lib/draft/`, `src/components/mock-draft/` (기존 `mock-draft` 기능 내부 변경)
- 초기 스트리머 10명 팀 배정(`SeriesSetup`)은 그대로 유지 — 없애는 건 **픽 스텝 중**
  플레이어 선택 과정뿐이다.
- 드래프트 완료 시점에 새 "픽 교환" 화면 추가: 팀 슬롯에 픽 순서대로 스트리머를
  기본 배정한 뒤, 같은 팀 내 두 슬롯을 클릭해 서로 교환. 그 아래 기존 승자 선택
  버튼을 이어 붙여 별도 확정 스텝 없이 한 화면에서 처리한다.

## 비범위 (YAGNI)

- 팀 간(블루↔레드) 픽 교환 없음 — 같은 팀 내부 스왑만.
- 역할군 기반 배정 제약 없음 — 자유 스왑(소프트 피어리스 검증만 예외).
- `SeriesSetup`, 바로 시작(autoAssign), 하드 피어리스, 초/갈 로직 변경 없음.
- `Series`/`SetResult`/localStorage 최상위 스키마 변경 없음 — `DraftState` 내부
  필드만 바뀐다.

## 데이터 모델 변경

### `DraftState` (`src/lib/draft/types.ts`)

```ts
export interface DraftState {
  map: string;
  firstPick: Team;
  cursor: number;
  bans: Record<Team, string[]>;
  picks: Record<Team, string[]>;        // 변경: [playerId, hero][] → hero명 배열 (픽 순서)
  assignment?: Record<Team, string[]>;  // 신규: cursor 완료 시 생성. playerId 배열, picks[team][i]에 대응
}
```

- `picks[team][i]`는 i번째로 픽한 영웅명. 플레이어 식별 없음.
- `assignment[team][i]`는 슬롯 i(=`series[team][i]`, 팀 설정 시 정한 순서·팀장 위치
  고정)에 배정된 플레이어 id. 드래프트 완료 시 기본값
  `assignment[team][i] = series[team][i].id` (즉 처음엔 슬롯 순서 = 픽 순서).
- `SetResult.picks`(`Record<Team, Pick[]>`, `Pick = [playerId, hero]`)는 **그대로
  유지** — `finishSet`에서 `picks[team][i]`와 `assignment[team][i]`를 zip해서
  기존 포맷으로 조립한다. 하위 통계(`heroesPlayedBy` 등)·스토리지 포맷 영향 없음.

## 엔진 변경 (`src/lib/draft/engine.ts`)

- `applyBan(state, hero)`: 변경 없음.
- `applyPick(state, hero)`: 시그니처에서 `playerId` 제거. `picks[team].push(hero)`.
- `undo(state)`: pop 대상이 `Pick` 튜플이 아니라 `string`이 되므로 그에 맞게 수정.
- `availableHeroes(series, state, forPlayerId?)`: `forPlayerId` 파라미터·소프트
  피어리스 필터링(픽 시점) 제거. 소프트 모드도 드래프트 중엔 하드와 동일하게
  "이번 세트 내 중복 방지"만 적용 — 팀별 재사용 제한은 교환 단계로 이동.
- 신규 `buildDefaultAssignment(series: Series, state: DraftState): Record<Team, string[]>`
  — 드래프트 완료(`isComplete`) 시 호출, 슬롯 순서대로 기본 매핑 생성.
- 신규 `canAssign(series: Series, team: Team, hero: string, playerId: string): boolean`
  — 소프트 피어리스에서만 의미 있음: `heroesPlayedBy(series.sets, playerId)`에
  `hero`가 있으면 `false`. 일반/하드는 항상 `true`.
- 신규 `swapAssignment(series, state, team, i, j): DraftState | null`
  — 슬롯 i·j의 배정 플레이어를 서로 바꾼 뒤 양쪽 다 `canAssign`으로 검증. 하나라도
  위반하면 `null` 반환(스왑 취소), 문제없으면 새 `DraftState` 반환.
- `finishSet(state, winner)`: `assignment`가 없으면(이론상 발생 안 함, 방어적으로만)
  기본 배정을 즉석 계산해서 사용. `Pick[]` 조립 후 기존 로직 그대로.

## UI 변경

### `DraftBoard` (`src/components/mock-draft/draft-board.tsx`)

- 픽 스텝 하단 액션바: "스트리머 선택" `<select>`/자동 배정 안내 텍스트 제거.
  밴이든 픽이든 영웅 그리드에서 고르고 확인 버튼만 누르면 된다.
- `TeamPanel`(드래프트 중): 스트리머 얼굴 대신 슬롯 5칸에 픽된 영웅만 순서대로
  표시(빈 슬롯은 대기 상태 육각). 선택 가능(selectable) 하이라이트 로직 제거.
- `isComplete(state)`가 참이 되는 순간 중앙 카드가 "드래프트 완료 — 승자 선택"
  대신 **"픽 교환"** 카드로 바뀐다:
  - 좌우 `TeamPanel`을 교환 모드로 렌더링: 이번엔 실제 스트리머 얼굴 + 배정된
    영웅을 슬롯에 표시(`assignment` 반영, 없으면 `buildDefaultAssignment`로 최초
    렌더 시 채움).
  - 슬롯 클릭 2회 = 같은 팀 내 스왑 시도. `swapAssignment`가 `null`을 반환하면
    (소프트 위반) 스왑 무시 + 짧은 경고 문구 표시, 성공하면 반영.
  - 카드 하단에 기존 승자 선택 버튼(블루 승/레드 승) 그대로 유지 — 별도 확정
    버튼 없이 바로 승자를 고르면 그 시점 `assignment`로 `finishSet` 호출.

## 에러 / 엣지 처리

- 소프트 피어리스 스왑 위반: 조용히 무시하지 않고 텍스트 경고(예: "OO는 이 영웅을
  이전 세트에서 이미 사용함") 잠깐 노출 후 사라짐. 별도 모달 없음.
- 바로 시작(autoAssign, 가짜 플레이어) 모드: 교환 화면은 동일하게 노출되지만
  검증 대상 자체가 없어(가짜 id는 이전 세트 기록도 자동으로 없음) 사실상 항상
  스왑 허용.
- 기존 진행 중 `localStorage` 데이터(`picks`가 `Pick[]` 형식)와의 하위 호환은
  고려하지 않는다 — 개발 중 기능이라 형식이 안 맞으면 "시리즈 초기화"로 사용자가
  직접 리셋한다.

## 테스트 (Vitest, `src/lib/draft/__tests__/engine.test.ts`)

- `applyPick`이 `picks[team]`에 영웅명만 push하는지.
- `buildDefaultAssignment`가 슬롯 순서 = `series[team][i].id`로 매핑하는지.
- `swapAssignment`: 일반/하드 모드는 항상 성공, 소프트 모드에서 위반 시 `null`.
- `finishSet`이 `picks` + `assignment`를 zip해 기존 `SetResult.picks`(`Pick[]`)
  포맷 그대로 생성하는지 — 기존 `heroesPlayedBy` 등 하위 로직과 호환 확인.

## 코딩 컨벤션

코멘트 한국어, 함수·변수 영어 camelCase, 파일 kebab-case.
