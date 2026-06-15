# ADR-0016 — 큐레이션 탭 캐시 버그 및 드래그 UX 수정

- **날짜**: 2026-06-16
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0012 (프로필 페이지 읽기 최적화), ADR-0007 (클라이언트 성능 최적화)

## 발단

메인 페이지(`/`)에서 자동·영웅 탭은 재방문 시 즉시 렌더링되지만,
큐레이션 탭(스트리머 티어표)은 탭 전환마다 로딩이 발생하고 Firestore reads가 발생하는 현상 확인.
추가로 편집 모드에서 스트리머 드래그가 잘 안 잡히는 UX 문제 병행 발견.

## 버그 1 — 큐레이션 탭 마운트마다 캐시 무시

**파일:** `src/components/curation-tier-tab.tsx`

### 원인 A — `getStreamers({ fresh: true })`

```ts
// 수정 전
const [s, m] = await Promise.all([
  getStreamers({ fresh: true }),  // ← 캐시 강제 무시
  getMatches(),
]);
const raw = await getCuratedTierLists(s.map(x => x.id));  // ← 순차 실행
```

`fresh: true`는 `streamersCache`를 무조건 우회해 Firestore를 재조회한다.
편집 모드 진입 시 최신 목록을 보장하기 위해 추가됐으나, 마운트 시에도 적용되어 매번 read를 유발.

### 원인 B — `getCuratedTierLists(streamerIds)` 캐시 스킵

```ts
// firestore.ts
if (isClient && curatedListsCache && !streamerIds) return curatedListsCache;
//                                   ^^^^^^^^^^^^ streamerIds 넘기면 캐시 무조건 스킵
```

삭제된 스트리머 제거(sanitize)를 위해 ID 목록을 넘겼는데, 이 조건 때문에
`curatedListsCache`가 채워져 있어도 항상 Firestore를 재조회.

### 수정

```ts
// 수정 후 — 세 요청 병렬화, 캐시 활용
const [s, m, raw] = await Promise.all([
  getStreamers(),         // 캐시 허용
  getMatches(),
  getCuratedTierLists(),  // streamerIds 없이 → 캐시 히트
]);
// sanitize는 기존 코드 그대로 메모리에서 처리
setLists(sanitizeLists(raw, s.map(x => x.id)));
```

- `fresh: true` 제거: 마운트 시 캐시 사용. 편집 모드 진입 시 별도 `useEffect`에서 `getStreamers({ fresh: true })` 재조회하므로 최신성 보장 유지.
- `getCuratedTierLists()` 인자 제거: 캐시된 전체 목록을 받아 컴포넌트 내 `sanitizeLists()`로 메모리 처리.
- 세 요청 `Promise.all` 병렬화: 첫 방문 시 로딩도 단축.

### DB reads 영향

| 상황 | 수정 전 | 수정 후 |
|------|--------|--------|
| 큐레이션 탭 첫 방문 | streamers N + matches M + curatedTiers 1 | 동일 |
| 탭 재방문 (SPA 이동) | streamers N + curatedTiers 1 | **0** |
| 편집 모드 진입 | + streamers N (별도 useEffect) | 동일 |

## 버그 2 — 편집 모드 드래그가 잘 안 잡히는 현상

**파일:** `src/components/hexagon-avatar.tsx`, `src/components/curation-tier-tab.tsx`

### 원인 A — `<img>` 기본 draggable

브라우저는 `<img>`를 기본적으로 `draggable="true"`로 취급한다.
아바타 이미지 위에서 드래그를 시작하면 부모 `div`의 `onDragStart` 대신
이미지 자체의 드래그가 먼저 발화해 `dataTransfer`에 streamer ID가 설정되지 않음.

**수정:** `hexagon-avatar.tsx`의 `<img>`에 `draggable={false}` 추가.

### 원인 B — 텍스트 선택 간섭

이름 `<span>` 위에서 드래그를 시작하면 브라우저가 텍스트 선택을 먼저 시작해
`dragstart` 이벤트가 발화하지 않음.

**수정:** `curation-tier-tab.tsx`의 `sharedStyle`에 `userSelect: editMode ? 'none' : undefined` 추가.
편집 모드 외에는 프로필 링크를 텍스트로 복사할 수 있도록 뷰 모드에서는 적용하지 않음.

## 알려진 잔여 이슈

- `hexagon-avatar.tsx`의 `clipPath: HEX_CLIP`으로 인해 육각형 모서리 공백(바운딩 박스 대비 ~25%)은 드래그 불가 영역으로 남음. 해소하려면 히트 영역을 별도로 확장해야 하며 현재는 허용 가능한 수준으로 판단.
