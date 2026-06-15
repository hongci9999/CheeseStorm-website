# ADR-0012 — 프로필 페이지 Firestore 읽기 최적화 (stats/current 확장)

- **날짜**: 2026-06-15
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0006 (트래픽 스파이크 대응), ADR-0010 (프로필 페이지 스트리밍)

## 발단

Firebase 콘솔 사용량 탭에서 **혼자 개발하는데 하루 14,000 reads** 발생을 확인.  
Spark 무료 플랜 일 한도 50,000 reads의 28.9% 소비.

## 원인 분석

### 개발 환경 14k reads의 원인

Next.js 핫리로드 시 모듈 레벨 캐시(`streamersCache`, `matchesCache`)가 초기화되어 매 저장마다 전체 컬렉션을 재fetch한다.

```
코드 저장 → 핫리로드 → streamers(N) + matches(M) fetch ≈ 70 reads
하루 200번 저장 × 70 reads = 14,000 reads
```

개발 환경에서는 **정상** 범위. 단, 프로덕션에서도 동일 구조이므로 방치하면 위험.

### 페이지별 read 분포

| 페이지 | reads/방문 | 1,000명이면 | 상태 |
|--------|-----------|------------|------|
| 홈 (티어리스트) | **1** (stats/current) | 1,000 | ADR-0006으로 이미 해결 ✓ |
| `/matches` (경기기록) | streamers + matches 전체 | ~70,000 | Spark 초과 위험 |
| `/streamers/[id]` (프로필) | streamers + matches 전체 | ~70,000 | Spark 초과 위험 |

클라이언트 모듈 캐시는 **같은 브라우저 탭 내 SPA 이동**에만 효과가 있다.  
새 탭 열기·새로고침·다른 기기 = 캐시 없음 = 전체 fetch.

## 고려한 선택지

### 선택지 A: Blaze 플랜 전환

Firebase 콘솔에서 클릭 5분으로 종량제 전환. 예산 알람($5) 설정.

- **비용**: 1,000명 × ~70 reads = 70,000 reads × $0.06/10만 ≈ **$0.04/일**, 시즌 2일 ≈ $0.1
- **장점**: 코드 변경 없음, 실시간 반영 그대로, 즉시 적용
- **단점**: 무료가 아님 (단, 금액이 미미함)

### 선택지 B: Next.js `unstable_cache` 적용

`getMatchesCached = cache(getMatches)` (React 요청 내 중복 제거)를 `unstable_cache`(Vercel 서버 레벨 캐시)로 교체.

```ts
export const getMatchesCached = unstable_cache(getMatches, ['matches'], { revalidate: 300 });
```

- **효과**: 5분 내 1,000명 방문 → Firestore hit ≈ 1번
- **문제**:
  - **5분 딜레이** — 경기 입력 후 최대 5분간 반영 안 됨. 내전 중 실시간성 손상
  - `Match` 타입의 `Date` 객체가 JSON 역직렬화 시 string으로 변환 → 별도 복원 로직 필요
  - Vercel 서버리스 재시작 시 캐시 초기화 → 첫 방문자가 full fetch

### 선택지 C: API 라우트 + revalidate (경기기록 페이지)

`/api/matches` route handler에 `export const revalidate = 300` 추가. 클라이언트가 Firestore 대신 API를 호출.

- **효과**: B와 동일한 서버 캐시 효과
- **문제**: `matches/page.tsx`가 `'use client'`라 서버 캐시 직접 적용 불가. API 라우트 신설 + 클라이언트 fetch 로직 변경 필요. 선택지 B보다 더 많은 코드 변경.

### 선택지 D: stats/current 패턴 확장 (채택)

ADR-0006에서 홈 페이지에 적용한 패턴을 **프로필 페이지**까지 확장.

`refreshStats()`가 스트리머별 프로필 집계를 `stats/current.profiles` 필드에 함께 저장.  
프로필 페이지는 `stats/current` 1 read만으로 전체 데이터를 렌더.

## 왜 선택지 D를 선택했나

| 기준 | A (Blaze) | B (unstable_cache) | D (stats/current 확장) |
|------|-----------|-------------------|----------------------|
| 실시간성 | ✓ 즉시 반영 | ✗ 최대 5분 지연 | ✓ 즉시 반영 |
| 코드 변경 | 없음 | 소량 | 중간 |
| 비용 | 시즌 ~$0.1 | 무료 | 무료 |
| 패턴 일관성 | — | 새 패턴 추가 | ✓ 기존 패턴 재사용 |
| 문서 크기 우려 | — | — | 22명 × 프로필 ≈ 200KB (한도 1MB의 20%) |

**선택지 D가 가장 합리적인 이유:**
1. 이미 홈 페이지에서 검증된 패턴 — 새로운 추상화 없음
2. 경기 추가/수정/삭제 시 자동 갱신 → 딜레이 없음
3. `Date` 직렬화 문제는 팀 저장 때 이미 해결한 `packTeam`/`unpackTeam` 방식으로 해결
4. `stats/current` 문서 크기: 실측 기준 현재 ~36KB, profiles 추가 후 ~200KB → 1MB 한도 여유

### 오버엔지니어링 우려

선택지 B, C에 대해 "연 2-3주만 운영하는 서비스에 캐싱 딜레이가 생기는 게 맞냐"는 논의가 있었다.  
→ 이 프로젝트의 핵심 속성은 **내전 중 실시간 반영**이므로, 딜레이 없는 D가 적합.  
→ 선택지 A(Blaze 전환)는 여전히 유효한 보완책 — D 구현 후에도 경기기록 페이지까지 최적화하려면 병행 권장.

## 구현

### `src/lib/firestore.ts`

**추가된 타입:**
- `StoredMatch`: Firestore 중첩 배열 금지 규칙 대응 (`blueTeam: [string,string][]` → `{id,hero}[]`)
- `PrecomputedProfile`: 스트리머 1명의 사전집계 프로필 전체 (kda, roleAffinity, heroAggregates, synergy, nemesis, maps, recentMatches, allMatches)

**수정된 함수:**
- `refreshStats()`: 스트리머 루프를 돌며 프로필을 계산해 `profiles` 필드에 저장
- `getPrecomputedStats()`: 반환 타입에 `profiles?: Record<string, PrecomputedProfile>` 추가

**추가된 함수:**
- `packMatchForStore(m: Match): StoredMatch` — 경기 직렬화 (Firestore 저장용)
- `unpackStoredMatch(m: StoredMatch)` — 역직렬화 (클라이언트 전달용)

### `src/app/streamers/[id]/page.tsx`

두 갈래 렌더 경로로 분기:

```
getPrecomputedStats() — stats/current 1 read
  ├─ profiles[id] 있음 → 빠른 경로 (Firestore 추가 read 없음)
  │    SidebarStatsSection(precomputed=...)
  │    ProfileTabsServer(precomputed=...)
  │
  └─ profiles[id] 없음 → 느린 경로 (기존 동작, 폴백)
       getStreamers() + getMatchesCached()
```

`SidebarStatsSection`, `ProfileTabsServer` 모두 선택적 `precomputed` prop 추가.  
precomputed가 있으면 `getMatchesCached()` 미호출.

### reads 비교

| 상황 | 기존 | 변경 후 |
|------|------|---------|
| 프로필 방문 1회 | ~70 reads | **1 read** |
| 1,000명 방문 | ~70,000 reads | **~1,000 reads** |
| 경기 1건 등록 | 0 | +70 reads (재집계, 1회성) |

## 알려진 한계

- **경기기록 페이지 (`/matches`)**: 여전히 전체 fetch. 1,000명이 이 페이지를 많이 방문하면 위험. Blaze 전환으로 보완 권장.
- **stats/current 미존재 시**: 폴백으로 기존 동작. 경기를 한 번 추가하면 자동 생성.
- **재집계 비용**: 경기 등록마다 22명 × 프로필 계산. 현재 규모에서는 무시 가능.
- **문서 크기 증가**: 스트리머·경기가 10배 늘면 1MB 한도 재검토 필요. 그 시점에 `stats/profiles/{id}` 서브컬렉션으로 분리 고려.

## 잔여 과제

- Blaze 전환 + 예산 알람($5) — 경기기록 페이지 방어
- 경기기록 페이지 최적화: ADR-0013 참조 (서버 컴포넌트 전환 + revalidateTag 계획)
