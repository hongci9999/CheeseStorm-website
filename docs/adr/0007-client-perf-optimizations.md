# ADR-0007 클라이언트 성능 최적화

- **날짜**: 2026-06-13
- **상태**: 채택

## 맥락

홈 페이지(`/`)는 `'use client'` 컴포넌트이며, 방문마다 `calcPlayerStats` + `calcHeroTiers`를 클라이언트에서 실행한다. 데이터 규모(스트리머 ~20명, 경기 ~50건)에서 절대 속도는 충분하나, 아래 세 가지 낭비가 식별됐다.

## 결정

### 1. `console.log` 제거 (`tier.ts`)

`calcPlayerStats` 내부에서 스트리머마다 발화하던 디버그 로그를 제거.  
스트리머 20명 기준 계산 1회당 20줄 출력 → DevTools 오염 + 문자열 보간 비용.

### 2. matches 정렬 중복 제거 (`tier.ts` + `heroes.ts`)

**기존 흐름:**
```
calcPlayerStats 호출 시:
  ① for each streamer:
       deriveRole(matches)     → [...matches].sort(desc)  // 스트리머마다 1회
       deriveFineRole(matches) → [...matches].sort(desc)  // 스트리머마다 1회
  ② sortedMatches = [...matches].sort(asc)               // 1회
합계: 스트리머 N명이면 2N+1 회 sort
```

**변경 후:**
```
calcPlayerStats 호출 시:
  ① sortedDesc  = [...matches].sort(desc)   // 1회
  ② sortedMatches = [...sortedDesc].reverse() // 복사+reverse (sort 없음)
  ③ for each streamer:
       deriveRole(sortedDesc, id, alreadySortedDesc=true)     // sort 생략
       deriveFineRole(sortedDesc, id, alreadySortedDesc=true) // sort 생략
합계: sort 1회 + reverse 1회
```

`deriveRole` / `deriveFineRole`에 `alreadySortedDesc: boolean = false` 파라미터 추가.  
기본값 `false`로 기존 호출부 하위 호환 유지.

### 3. `useMemo` — 역할 필터 재계산 방지 (`page.tsx`)

`AutoTierTab` / `HeroTierTab`에서 역할 탭 클릭마다 `filter` + `groupStatsByTier` / `groupHeroesByTier`가 재실행됐다. `useMemo`로 `[stats, role]` / `[heroTiers, role]` 의존성에 묶어 불필요한 재계산 방지.

## 미채택 — `fresh: true` 유지

홈 재방문 시 `getStreamers({ fresh: true })`로 Firestore를 항상 재조회하는 동작은 유지.  
이유: 내전 진행 중 다른 기기에서 경기가 추가될 수 있어, 캐시를 믿으면 stale 티어리스트가 표시된다.  
트레이드오프: 홈 재방문 비용(네트워크 RTT 1회) vs 즉각적인 최신 데이터. 현재 규모에서 Firestore 요청 비용이 미미하므로 정확성 우선.

## 미채택 — `unstable_cache` / ISR

프로필 페이지(`/streamers/[id]`)의 Server Component가 요청마다 Firestore를 2회 조회하는 문제는 이번 범위에서 제외. 트래픽이 증가하거나 Spark 플랜 한계에 근접할 때 ADR-0006 스케일링 플랜과 함께 검토.

## 영향 범위

| 파일 | 변경 |
|------|------|
| `src/lib/tier.ts` | console.log 제거, sort 통합 |
| `src/lib/heroes.ts` | `deriveRole` · `deriveFineRole` 파라미터 추가 |
| `src/app/page.tsx` | `useMemo` import 추가, AutoTierTab · HeroTierTab 메모화 |
