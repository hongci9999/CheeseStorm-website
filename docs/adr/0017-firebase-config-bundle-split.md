# ADR-0017 firebase 설정 플래그를 SDK 없는 모듈로 분리

- **날짜**: 2026-06-22
- **상태**: 채택

## 맥락

`site-header.tsx`는 글로벌 레이아웃(`layout.tsx`)에 포함되어 **모든 라우트가 공유**하는 컴포넌트다. 헤더는 오프라인 뱃지 노출 여부를 판단하려고 `isFirebaseConfigured` 불리언 하나를 필요로 했고, 이를 `@/lib/firestore`에서 import 했다.

문제는 import 그래프다. `firestore.ts`는 모듈 최상단에서 `firebase/firestore` SDK 전체와 tier·hero·profile 로직을 import 한다. 번들러 관점에서 "이 모듈에서 값 하나를 꺼낸다 = 모듈 전체를 그래프에 포함"이므로, 불리언 하나 때문에 firestore SDK(약 270KB)가 헤더의 의존성으로 끌려왔다.

헤더는 공유 청크이므로 결과적으로 **firestore SDK가 모든 라우트에 강제로 실렸다** — `/guide`, `/matches/[id]`, `/streamers/[id]`처럼 클라이언트에서 Firestore를 전혀 호출하지 않는 페이지까지.

빌드 산출물 측정값:
- 총 클라이언트 JS ~1,045KB 중 firestore SDK 청크 = 270KB (단일 최대 무게)
- 이 청크가 layout 공유 청크에 묶여 전 라우트 첫 로딩에 포함

## 결정

순수 env 체크를 SDK import가 전혀 없는 독립 모듈로 분리한다.

```ts
// src/lib/firebase-config.ts — firebase SDK import 없음
export const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
```

- `site-header.tsx`는 이 모듈을 직접 참조 → firestore 모듈을 거치지 않아 SDK가 번들에서 빠진다.
- `firebase.ts`·`firestore.ts`는 같은 값을 re-export 하여 기존 호출부(`streamers/page.tsx`, `matches/new/page.tsx` 등) 하위 호환을 유지한다. 이 페이지들은 어차피 Firestore SDK를 실제로 사용하므로 청크가 빠질 필요가 없다.

## 결과

firestore SDK 청크가 **layout 공유 → 페이지별**로 이동했다. 빌드 매니페스트 기준:

| 라우트 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `/`, `/matches`, `/matches/new`, `/streamers` | 270KB 로드 | 270KB (SDK 실사용) |
| `/guide` | 270KB | 0 |
| `/matches/[id]` (경기 상세) | 270KB | 0 |
| `/streamers/[id]` (프로필) | 270KB | 0 |
| `/dev-login`, not-found | 270KB | 0 |

경기 상세·프로필은 흔한 진입점이므로 첫 로딩에서 270KB를 덜 받는다. 모바일·느린 망에서 체감 이득.

## 교훈

번들 무게는 "무엇을 쓰느냐"가 아니라 "어디서 import 하느냐"가 결정한다. 가벼운 값이라도 무거운 모듈을 경유해 import 하면 그 무게가 전부 따라온다. 특히 **글로벌 컴포넌트(layout·header)의 import는 모든 페이지로 퍼지므로**, 거기서는 무거운 모듈을 경유하지 않도록 주의한다.

## 미채택 — 클라이언트 read의 서버 라우트 이전

`/`, `/matches`, `/streamers`는 여전히 클라이언트에서 직접 Firestore를 읽으므로 SDK를 싣는다. 이를 API 라우트(`api-client`) 경유로 옮기면 이 셋도 SDK를 분리할 수 있으나, 동작 변경 범위가 크고 캐시·인증 흐름에 영향을 주므로 이번 범위에서 제외. 트래픽 증가 시 ADR-0006 스케일링 플랜과 함께 검토.

## 영향 범위

| 파일 | 변경 |
|------|------|
| `src/lib/firebase-config.ts` | 신규 — SDK import 없는 순수 env 플래그 |
| `src/components/site-header.tsx` | `isFirebaseConfigured` import 경로를 `firebase-config`로 교체 |
| `src/lib/firebase.ts` | 플래그를 `firebase-config`에서 re-export (단일 소스화) |
