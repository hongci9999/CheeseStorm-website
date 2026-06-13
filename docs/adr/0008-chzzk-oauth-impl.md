# ADR-0008 — 치지직 OAuth 2.0 직접 구현 (NextAuth 미사용)

## 상태

완료

## 결정

치지직(CHZZK) OAuth 2.0 인증 흐름을 직접 구현한다. NextAuth를 사용하지 않는다.  
세션은 `jose`로 발급한 JWT를 httpOnly 쿠키에 저장한다.

## 이유

- 치지직은 NextAuth 기본 지원 플랫폼이 아니다. 커스텀 프로바이더로 구현하면 NextAuth의 세션 모델·콜백 구조에 종속되어 오히려 복잡도가 높아진다.
- 직접 구현 시 토큰 구조와 세션 페이로드를 완전히 제어할 수 있다.
- `jose`는 Edge Runtime 호환 JWT 라이브러리로, Next.js 미들웨어에서 추가 설정 없이 사용 가능하다.

## 권한 모델

로그인 시 `resolveRole(chzzkId)`를 1회 실행해 역할을 결정하고 JWT에 캐싱한다. 매 요청마다 Firestore를 조회하지 않는다.

| 역할 | 조건 |
|------|------|
| `admin` | `ADMIN_CHZZK_ID` env var와 일치 |
| `streamer` | `streamers` Firestore 컬렉션에 해당 chzzkId 존재 |
| `viewer` | 그 외 (로그인 불필요, 읽기 전용) |

## 치지직 API 비표준 동작

치지직 OpenAPI는 표준 OAuth 2.0 스펙과 다른 동작을 한다.

**1. 인가 URL 파라미터가 camelCase**

표준 OAuth는 `client_id`, `redirect_uri`를 사용하나, 치지직은 `clientId`, `redirectUri`를 요구한다.

**2. 모든 응답이 `{ content: {...} }` 래퍼로 감싸임**

토큰 교환(`/auth/v1/token`)과 유저 정보(`/open/v1/users/me`) 응답 모두 다음 구조를 가진다:

```json
{ "content": { "accessToken": "...", "channelId": "..." } }
```

표준 OAuth를 가정해 `res.json()`을 그대로 쓰면 `accessToken`이 `undefined`가 되어 유저 정보 조회에서 401이 발생한다. 모든 응답에서 `data.content ?? data`로 언래핑하는 패턴을 통일했다.

**3. 토큰 교환 요청 body가 JSON (form-urlencoded 아님)**

표준 OAuth는 `application/x-www-form-urlencoded`를 사용하나, 치지직은 `application/json`을 요구한다.

## 개발 환경 편의

프로덕션에서 비활성화되는 `/api/auth/dev-login` 엔드포인트를 제공한다.  
`DEV_LOGIN_SECRET`으로 게이팅하며, 임의 chzzkId로 세션을 발급해 OAuth 없이 권한별 동작을 테스트할 수 있다.

## 결과

- ADR-0004에서 유보했던 인증이 완료됨
- Firestore 쓰기 작업(경기 입력, 큐레이션 편집)은 `streamer` 이상 권한에서만 가능
- `/matches/new` 라우트는 미들웨어로 보호 (Edge Runtime, `jose` 사용)
