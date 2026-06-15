# ADR-0013 — 경기기록 페이지 서버 컴포넌트 전환

- **날짜**: 2026-06-15
- **상태**: 채택 (미구현)
- **관련**: ADR-0012 (프로필 페이지 읽기 최적화)

## 발단 — 자주 드는 오해: "더 보기로 나누면 reads가 줄지 않나?"

화면 표시 개수를 줄이는 것과 Firestore reads는 무관하다.

```
현재 흐름:
useEffect → getMatches() → 문서 100개 fetch → 화면엔 10개만 표시
                ↑ 여기서 100 reads 발생 — 화면에 몇 개 보여주든 동일
```

Firestore는 **fetch한 문서 수**로 과금한다. "더 보기" 버튼으로 표시만 나눠도, 첫 mount 시 전부 가져온다면 reads는 그대로다. 프로필 탭의 "더 보기"도 이미 받은 데이터를 `slice()`로 잘라 보여줄 뿐이다.

검색도 마찬가지 — 현재 클라이언트 `filter()`로 처리하므로 검색 시 Firestore 추가 요청 없음.

**reads를 실제로 줄이려면** 화면 표시가 아니라 **Firestore에 얼마나 요청하느냐**를 바꿔야 한다.

## 왜 'use client'에서 서버 캐시가 동작하지 않나

Next.js에서 코드가 실행되는 위치:

```
서버 (Vercel)                  클라이언트 (사용자 브라우저)
──────────────────             ──────────────────────────
1,000명이 접속해도             접속한 사람마다
딱 한 곳에서 실행              각자 브라우저에서 실행
→ 여기에 캐시를 두면 공유 가능  → 캐시 두어도 공유 불가
```

`'use client'`는 "이 코드는 각자 브라우저에서 실행해"라는 선언이다. 서버 캐시를 만들어도 각 브라우저가 Firestore에 직접 요청하므로 캐시가 우회된다.

```
홈 페이지 (서버 컴포넌트)         경기기록 페이지 ('use client')
서버에서 stats/current 1 read →  브라우저에서 getMatches() 호출
1,000명 = 1 read                 1,000명 = 1,000 reads
```

## 결정 — 서버 컴포넌트 + 클라이언트 아일랜드 + revalidateTag

**변환 구조:**

```
page.tsx (서버 컴포넌트)
  → getStreamers() + unstable_cache(getMatches, ['matches'], { tags: ['matches'] })
  → 서버에서 세션 쿠키 읽어 isStreamer 판별
  → <MatchesClient matches={...} streamers={...} isStreamer={...} />

MatchesClient (use client)
  → 검색 필터링 (useState + 클라이언트 filter)
  → 경기 상세 펼치기/닫기
  → 삭제 버튼 + router.refresh()
```

**즉시 반영 보장 (revalidateTag):**

```ts
// addMatch / deleteMatch / updateMatch 끝에 추가
revalidateTag('matches')   // 캐시 즉시 만료
void refreshStats()        // 기존 stats/current 갱신 유지
```

캐시가 만료되면 다음 방문자가 Firestore를 재fetch하며 캐시가 재생성된다. 5분 딜레이 없이 즉시 반영.

**reads 비교:**

| 상황 | 기존 | 변환 후 |
|------|------|---------|
| 방문 1회 | ~150 reads | ~150 reads (첫 방문) |
| 1,000명 방문 | ~150,000 reads | **~150 reads** (캐시 공유) |
| 경기 추가 시 | 0 | revalidateTag → 다음 방문자가 재fetch |

## 왜 처음부터 서버 컴포넌트로 만들지 않았나

두 가지 이유:

1. **개발자 관성** — 검색창이 있으면 `useState` 필요 → `'use client'` 붙이는 게 자연스러운 흐름. 인터랙티브 UI를 만들 때 클라이언트 컴포넌트로 시작하는 것이 Next.js 개발의 기본 반응.

2. **문제 가시성** — reads 비용은 Firebase 콘솔에서 직접 수치를 보기 전까지 눈에 안 들어온다. 14k reads를 콘솔에서 확인한 뒤에야 구조적 문제가 드러났다.

실제 문제가 없으면 우선순위가 없다. 이제 문제가 보였으니 지금 변환하면 된다.

## 서버 컴포넌트를 쓰지 않는 경우

서버 컴포넌트로 전환해도 해결이 안 되는 두 가지 상황:

**1. 새로고침 없이 자동 실시간 반영**

서버 컴포넌트는 브라우저가 요청할 때만 데이터를 준다. 브라우저가 안 물어봐도 서버가 먼저 알림을 보내는 구조(Firestore `onSnapshot`, WebSocket)는 클라이언트 컴포넌트에서만 가능하다.

```
서버 컴포넌트: 브라우저가 "줘" → 서버가 "여기"  (요청-응답)
onSnapshot:   데이터 바뀌면 서버가 먼저 "바뀌었어!"  (푸시)
```

"운영자가 경기 입력하는 순간 모든 시청자 화면에 자동 반영" 같은 기능은 `onSnapshot`이 필요하며, 서버 컴포넌트로 대체 불가.

**2. 브라우저 전용 API**

`localStorage`, 드래그앤드롭, 카메라, `window`/`document` 를 직접 쓰는 외부 라이브러리 등 서버 환경에서 실행 자체가 안 되는 코드.

**이 프로젝트의 경우:** 경기 목록은 "새로고침하면 최신 데이터" 수준으로 충분하다. 내전 중 자동 실시간 갱신이 필요해진다면 그 시점에 `onSnapshot`으로 교체하면 된다.

## 구현 시 주의사항

- `useAuth` 훅 제거 → 서버에서 `getSession()` 으로 대체, `isStreamer` prop으로 전달
- `getMatchesCached` (React.cache) → `unstable_cache` 로 교체 (서버 요청 간 공유)
- 삭제 후 `router.refresh()` 는 그대로 유지 (서버 재렌더 트리거)

## 잔여 과제

- [ ] `src/app/matches/page.tsx` 서버 컴포넌트 전환 구현
- [ ] `src/components/matches-client.tsx` 신규 작성 (검색/펼치기/삭제 UI)
- [ ] `src/lib/firestore.ts` — `addMatch/deleteMatch/updateMatch`에 `revalidateTag('matches')` 추가
