# ADR-0014 — DB 캐시 정합성 버그 수정

- **날짜**: 2026-06-16
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0012 (프로필 페이지 읽기 최적화), ADR-0013 (경기기록 서버 컴포넌트 전환)

## 발단

ADR-0012에서 `firestore-admin.ts`의 `refreshStats()`가 `profiles` 필드를 저장하지 않는 버그를 수정하면서, 동일한 패턴의 버그가 더 있는지 전수 감사를 실시.

## 발견된 버그

### 버그 1 — `firestore-admin.ts`의 `refreshStats()`에서 `profiles` 누락 (ADR-0012에서 수정)

**원인:** `firestore.ts`의 `refreshStats()`와 `firestore-admin.ts`의 `refreshStats()`가 별도로 존재.  
`firestore.ts`에 `profiles` 집계가 추가될 때 `firestore-admin.ts`에 반영되지 않음.

**영향:** API 라우트를 통한 모든 쓰기 작업(경기 추가/수정/삭제, 스트리머 추가/삭제) 후  
`stats/current`에 `profiles` 없이 저장 → 프로필 페이지 빠른 경로 동작 불가 → 전체 컬렉션 폴백.

### 버그 2 — `updateStreamerInfo` / `updateStreamerGameNames` / `updateStreamerProfileImage` 후 `refreshStats()` 누락

**파일:** `src/lib/firestore-admin.ts`

**원인:** 스트리머 이름·닉네임·프로필 이미지를 변경하는 함수들이 `refreshStats()`를 호출하지 않음.

**영향:**
- 이름 변경 → 티어리스트·프로필 페이지에 구 이름 계속 표시
- 닉네임 변경 → `stats/current`의 `gameNames` 미갱신
- 프로필 이미지 변경 → `stats/current`의 `profileImageUrl` 미갱신

### 버그 3 — `updateMatchDate` 후 `refreshStats()` 누락

**파일:** `src/lib/firestore-admin.ts`

**원인:** `updateMatch()`는 `refreshStats()`를 호출하지만 `updateMatchDate()`는 호출하지 않음.

**영향:** 날짜 변경 후 `stats/current`의 `recentMatches` 정렬이 갱신되지 않아 프로필 페이지 최근 경기 목록이 잘못된 순서로 표시.

### 버그 4 — `POST /api/streamers` 후 `updateTag` 누락

**파일:** `src/app/api/streamers/route.ts`

**원인:** 스트리머 추가 API에 `updateTag('streamers')` 미포함.

**영향:** 스트리머 추가 후 `getStreamersCachedServer()`(`unstable_cache`)가 stale 데이터 반환 → 경기기록 페이지에 새 스트리머 미표시.

### 버그 5 — `PATCH|DELETE /api/streamers/[id]` 후 `updateTag` 누락

**파일:** `src/app/api/streamers/[id]/route.ts`

**원인:** 스트리머 수정·삭제 API에 `updateTag('streamers')` 미포함.

**영향:** 스트리머 이름 변경·삭제 후 서버 캐시가 stale 상태 유지 → 경기기록 페이지에 삭제된 스트리머 이름 계속 표시 또는 변경 전 이름 유지.

## 근본 원인

두 종류의 캐시가 독립적으로 관리되고 있으며, 쓰기 함수마다 둘 다 처리해야 한다:

```
데이터 변경
  ├─ void refreshStats()    → stats/current 집계 갱신 (프로필 빠른 경로용)
  └─ updateTag('tag')       → unstable_cache 무효화 (서버 컴포넌트 캐시용)
```

`updateTag` 미호출 시: 경기기록 페이지(`/matches`)가 stale 스트리머 목록 사용  
`refreshStats()` 미호출 시: 프로필 페이지(`/streamers/[id]`)가 stale 집계 데이터 표시

## 수정 내용

### `src/lib/firestore-admin.ts`

`refreshStats()` 호출 추가 (4곳):
- `updateStreamerInfo()` 끝
- `updateStreamerGameNames()` 끝
- `updateStreamerProfileImage()` 끝
- `updateMatchDate()` 끝

### `src/app/api/streamers/route.ts`

- `import { updateTag } from 'next/cache'` 추가
- `addStreamer` 호출 후 `updateTag('streamers')` 추가

### `src/app/api/streamers/[id]/route.ts`

- `import { updateTag } from 'next/cache'` 추가
- PATCH 핸들러 성공 응답 직전 `updateTag('streamers')` 추가
- DELETE 핸들러 성공 응답 직전 `updateTag('streamers')` 추가

### `src/lib/firestore.ts` (ADR-0012 수정 포함)

- `StoredMatch` 타입 export 추가
- `packMatchForStore()` 함수 export 추가 (`firestore-admin.ts`에서 재사용)

## Next.js 16 캐시 API 참고

ADR-0013에서 `revalidateTag`로 기술됐으나, **Next.js 16에서 API가 변경됨**:

```ts
// Next.js 16 next/cache 타입 정의
revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined  // 2개 인수 필수
updateTag(tag: string): undefined  // 단순 무효화 — 현재 사용 중인 API
```

`unstable_cache` 태그 단순 무효화 목적에는 `updateTag(tag)` 가 올바른 API.  
단, 타입 주석에 "Server Action에서만 사용 권장"으로 명시되어 있으나, Route Handler에서도 빌드·런타임 정상 동작 확인됨.

## 완전한 캐시 무효화 매트릭스

| 함수 | refreshStats() | updateTag('matches') | updateTag('streamers') |
|------|:-:|:-:|:-:|
| `addMatch` | ✅ | ✅ | — |
| `deleteMatch` | ✅ | ✅ | — |
| `updateMatch` | ✅ | ✅ | — |
| `updateMatchDate` | ✅ (수정) | ✅ | — |
| `addStreamer` | ✅ | — | ✅ (수정) |
| `deleteStreamer` | ✅ | — | ✅ (수정) |
| `updateStreamerInfo` | ✅ (수정) | — | ✅ (수정) |
| `updateStreamerGameNames` | ✅ (수정) | — | ✅ (수정) |
| `updateStreamerProfileImage` | ✅ (수정) | — | ✅ (수정) |
| `saveCuratedTierLists` | — | — | — (stats 무관) |
| `upsertOcrCorrection` | — | — | — (stats 무관) |

## 알려진 잔여 이슈

- **두 `refreshStats()` 중복**: `firestore.ts`와 `firestore-admin.ts`에 동일한 profiles 집계 루프가 존재. 향후 스키마 변경 시 두 곳 모두 수정 필요. `buildStatsPayload()` 공통 함수로 추출하면 해소되나 현재 규모에서는 허용 가능한 기술 부채.
