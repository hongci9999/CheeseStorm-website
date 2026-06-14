# ADR-0010 스트리머 프로필 페이지 로딩 성능 개선

- **날짜**: 2026-06-15
- **상태**: 채택
- **관련**: ADR-0007 (클라이언트 성능 최적화) — 미채택으로 남겨둔 프로필 페이지 Firestore 중복 호출 문제를 이 ADR에서 해결

## 맥락

`/streamers/[id]` 페이지는 서버 컴포넌트이며, 진입 시 다음 흐름을 직렬로 실행했다.

```
클릭 → router.push()
  → 서버: await getStreamers() + await getMatches()  ← 두 쿼리 완료될 때까지 블로킹
  → HTML 전송 → 페이지 전환
```

`getMatches()`는 컬렉션 전체를 읽는 쿼리로, 경기 데이터가 쌓일수록 느려진다. 사용자 입장에서는 카드의 스피너가 도는 동안 아무런 시각적 피드백 없이 기다려야 했다.

추가로, Suspense 스트리밍을 도입할 경우 사이드바 stats와 탭 섹션이 각각 독립적으로 `getMatches()`를 호출해 Firestore를 2회 실행할 위험이 있었다.

## 결정

### 1. `loading.tsx` — 즉각적인 스켈레톤

Next.js App Router의 `loading.tsx` 파일을 추가하면, `page.tsx` 서버 실행이 시작되는 즉시 브라우저에 스켈레톤 UI를 표시하고 렌더링이 완료되면 교체한다. 별도 클라이언트 상태 없이 파일 하나로 체감 속도를 개선한다.

### 2. Suspense 스트리밍 — 단계별 렌더

`page.tsx`를 다음 구조로 재편했다.

```
ProfilePage (서버 컴포넌트)
│
├─ await getStreamers()  ← 빠름. 스트리머 메타데이터만 포함
│
├─ <StaticProfileCard>   ← getStreamers() 결과로 즉시 렌더
│    아바타 · 이름 · 배틀태그 · 계정레벨
│
├─ <Suspense fallback={<SidebarStatsSkeleton />}>
│    └─ <SidebarStatsSection>  ← async 서버 컴포넌트
│         await getMatchesCached()
│         티어 · 승률 · KDA · 포지션 분포
│
└─ <Suspense fallback={<TabsSkeleton />}>
     └─ <ProfileTabsServer>   ← async 서버 컴포넌트
          await getMatchesCached()   ← React.cache()로 위와 공유
          개요 · 영웅 · 전체 매치 탭
```

결과적으로 스트리머 아이덴티티(아바타·이름)는 `getStreamers()` 완료 즉시 표시되고, stats와 탭은 `getMatches()` 완료 후 동시에 스트리밍된다.

### 3. `React.cache()` — Firestore 중복 호출 제거

`SidebarStatsSection`과 `ProfileTabsServer`가 동일 요청 내에서 각각 `getMatches()`를 호출하면 Firestore를 2회 실행하게 된다. `React.cache()`로 감싼 `getMatchesCached`를 사용하면 동일 렌더 패스 내 첫 번째 호출만 실행되고 두 번째는 캐시된 Promise를 공유한다.

```ts
// src/lib/firestore.ts
import { cache } from 'react';
export const getMatchesCached = cache(getMatches);
```

`React.cache()`는 서버 렌더링 요청 단위로 격리되므로, 요청 간 데이터 오염이 없다.

### 4. 전체 매치 탭 페이지네이션

기존에는 스트리머의 전체 경기 목록을 한 번에 렌더했다. 이를 10경기씩 보여주고 **더 보기** 버튼으로 추가 로드하는 방식으로 변경했다. 데이터는 props로 이미 전달된 상태이므로 추가 네트워크 요청 없이 클라이언트에서 `slice(0, visibleCount)`로 처리한다.

## 미채택 — 서버사이드 레이지 로딩

"더 보기" 시점에 서버에서 추가 경기를 Firestore로 페치하는 방식은 검토했으나 채택하지 않았다. 현재 내전 규모(시즌당 ~50–100경기)에서는 전체 데이터를 한 번에 전송하는 비용이 미미하고, Server Action이나 API 라우트 추가 없이 클라이언트 `useState`만으로 구현할 수 있기 때문이다.

## 미채택 — `unstable_cache` / ISR

`getMatches()` 결과를 Next.js 레벨에서 캐싱해 재사용하는 방안은 유보. 내전 진행 중 경기가 실시간으로 추가되므로 stale 데이터를 서빙할 위험이 있으며, ADR-0006의 트래픽 스파이크 플랜과 함께 검토할 사항이다.

## 타임라인 (사용자 체감 흐름)

| 시점 | 화면 |
|------|------|
| 카드 클릭 직후 | `loading.tsx` 스켈레톤 (전체 레이아웃 윤곽) |
| `getStreamers()` 완료 | 아바타 · 이름 · 태그 · 레벨 카드 표시, Suspense 스켈레톤 유지 |
| `getMatchesCached()` 완료 | 티어·승률·포지션 카드 + 전체 탭 동시 스트리밍 |

## 영향 범위

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/globals.css` | `@keyframes skel-pulse` 추가 |
| `src/lib/firestore.ts` | `import { cache } from 'react'`, `getMatchesCached` export 추가 |
| `src/app/streamers/[id]/loading.tsx` | **신규** — 전체 페이지 스켈레톤 |
| `src/app/streamers/[id]/page.tsx` | `StaticProfileCard`, `SidebarStatsSection`, `ProfileTabsServer` 분리, Suspense 래핑 |
| `src/app/streamers/[id]/profile-tabs.tsx` | 전체 매치 탭에 `visibleCount` 상태 + 더 보기 버튼 추가 |
