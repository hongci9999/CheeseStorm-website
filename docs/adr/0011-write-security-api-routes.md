# ADR-0011 Firestore 쓰기 보안 — API 라우트 + Admin SDK

- **날짜**: 2026-06-15
- **상태**: 채택
- **관련**: ADR-0008 (치지직 OAuth 구현) — 인증 레이어와 연계

## 맥락

기존 구현에서 Firestore 쓰기는 클라이언트 브라우저의 Firebase SDK가 직접 수행했다.

```
클라이언트 → Firebase Client SDK → Firestore (rules: allow write: if true)
```

이 구조의 근본적 문제:

1. **Firebase Auth 미연동** — 이 프로젝트는 치지직 OAuth + `jose` JWT로 자체 인증을 구현하며 Firebase Auth를 사용하지 않는다. Firestore 보안 규칙은 Firebase Auth 토큰만 검증할 수 있어, 커스텀 JWT로는 규칙 단에서 권한을 확인하는 방법이 없다.

2. **규칙 `allow write: if true` 필수** — 위 이유로 규칙을 열어둬야 했고, 이는 Firebase 프로젝트 설정(`NEXT_PUBLIC_*`)이 브라우저에 노출된 상태에서 누구든 Firebase SDK로 Firestore에 직접 쓸 수 있음을 의미한다. 프론트엔드 `isStreamer` 체크는 UI 레이어에만 존재할 뿐 실질 보안이 아니었다.

## 결정

**모든 Firestore 쓰기를 Next.js API 라우트로 이전하고, 서버에서 Firebase Admin SDK를 사용한다.**

```
클라이언트 → fetch() → API Route (JWT 검증) → Admin SDK → Firestore (rules: allow write: if false)
```

### Firestore 보안 규칙

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

읽기는 공개 유지(티어리스트·전적 조회는 인증 불필요), 쓰기는 완전 차단. Admin SDK는 규칙을 우회하므로 서버 API 라우트만 쓰기 가능.

### 레이어 구조

| 레이어 | 역할 | 파일 |
|---|---|---|
| 클라이언트 fetch 래퍼 | 기존 함수 시그니처 유지, 내부적으로 `fetch()` 호출 | `src/lib/api-client.ts` |
| API 라우트 | JWT 세션 검증 + 역할 확인 → Admin SDK 호출 | `src/app/api/{resource}/route.ts` |
| Auth 헬퍼 | `requireRole(minRole)` — 쿠키 → JWT 파싱 → 권한 비교 | `src/lib/api-auth.ts` |
| Admin SDK 초기화 | 서비스 계정 인증, 싱글턴 | `src/lib/firebase-admin.ts` |
| Admin SDK 쓰기 함수 | 클라이언트 SDK 버전과 동일 로직, Admin SDK 사용 | `src/lib/firestore-admin.ts` |

### API 엔드포인트

| 엔드포인트 | 메서드 | 최소 권한 | 동작 |
|---|---|---|---|
| `/api/streamers` | POST | streamer | 스트리머 추가 |
| `/api/streamers/[id]` | PATCH | streamer | 이름·게임이름·프로필사진 수정 |
| `/api/streamers/[id]` | DELETE | admin | 스트리머 삭제 |
| `/api/matches` | POST | streamer | 경기 등록 |
| `/api/matches/[id]` | PATCH | streamer | 경기 수정 |
| `/api/matches/[id]` | DELETE | streamer | 경기 삭제 |
| `/api/curated-tiers` | PUT | streamer | 큐레이션 티어표 저장 |
| `/api/ocr-corrections` | POST | streamer | OCR 교정 맵 저장 |

### 환경 변수 추가

```
FIREBASE_CLIENT_EMAIL=   # 서비스 계정 이메일
FIREBASE_PRIVATE_KEY=    # 서비스 계정 비공개 키 (\\n 이스케이프 포함, 큰따옴표 감쌈)
```

Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성.

### 클라이언트 캐시 무효화

기존 쓰기 함수들은 `streamersCache = null` 등으로 인메모리 캐시를 직접 초기화했다. API 라우트 경유 후에는 서버에서 캐시를 건드릴 수 없으므로, `api-client.ts`의 각 래퍼가 성공 응답 후 `invalidateStreamersCache()` 등을 호출한다.

### 큐레이션 티어 저장 시점 변경

기존에는 드래그할 때마다 Firestore에 즉시 저장했다. API 라우트 이전과 함께 **편집 완료** 버튼 클릭 시 한 번만 저장하도록 변경 — 중간 상태가 반복 저장되던 낭비를 제거하고, 저장 실패 시 편집 모드를 유지해 재시도 가능하게 한다.

## 미채택 — Firebase Auth 커스텀 토큰

치지직 JWT를 Firebase 커스텀 토큰으로 교환하면 Firestore 규칙에서 `request.auth`를 사용할 수 있다. 그러나 토큰 교환 흐름이 복잡하고, Admin SDK + API 라우트가 동일한 보안 수준을 더 단순하게 달성하므로 채택하지 않았다.

## 영향 범위

| 파일 | 변경 내용 |
|---|---|
| `src/lib/firebase-admin.ts` | **신규** — Admin SDK 초기화 (`cert()`) |
| `src/lib/firestore-admin.ts` | **신규** — Admin SDK 버전 write 함수 전체 |
| `src/lib/api-auth.ts` | **신규** — `requireRole(minRole)` 공통 헬퍼 |
| `src/lib/api-client.ts` | **신규** — 클라이언트 fetch 래퍼 (캐시 무효화 포함) |
| `src/app/api/streamers/route.ts` | **신규** — POST |
| `src/app/api/streamers/[id]/route.ts` | **신규** — PATCH · DELETE |
| `src/app/api/matches/route.ts` | **신규** — POST |
| `src/app/api/matches/[id]/route.ts` | **신규** — PATCH · DELETE |
| `src/app/api/curated-tiers/route.ts` | **신규** — PUT |
| `src/app/api/ocr-corrections/route.ts` | **신규** — POST |
| `src/lib/firestore.ts` | `invalidateStreamersCache` 등 캐시 무효화 함수 export 추가 |
| `src/app/matches/page.tsx` | `deleteMatch` → `api-client` |
| `src/app/matches/new/page.tsx` | `addMatch` · `updateMatch` · `upsertOcrCorrection` → `api-client` |
| `src/app/streamers/page.tsx` | streamer 쓰기 함수 전체 → `api-client` |
| `src/components/curation-tier-tab.tsx` | `saveCuratedTierLists` → `api-client`, 저장 시점 편집 완료로 변경 |
| `.env.local.example` | `FIREBASE_CLIENT_EMAIL` · `FIREBASE_PRIVATE_KEY` 추가 |
