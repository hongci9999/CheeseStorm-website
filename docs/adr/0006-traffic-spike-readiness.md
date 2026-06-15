# ADR-0006 — 트래픽 스파이크 대응 (읽기 폭증 방어)

## 상태

완료 — 이벤트 기반 사전집계 구현 (1순위 적용)  
확장: ADR-0012에서 프로필 페이지까지 동일 패턴 적용

## 맥락

연 2–3주만 활발히 운영되며, 그 기간 중 **동시접속 천 명 규모가 1–2일 짧게 튀는** 패턴이 예상된다.

현재 모든 파생 통계는 **요청 시 실시간 재계산**한다. 캐시·사전집계 없음.

- 자동 티어 — [tier.ts](../../src/lib/tier.ts) `calcPlayerStats`→`calcTier`, [page.tsx](../../src/app/page.tsx) 클라이언트 로드 시
- 상대전적(시너지/천적) — [relations.ts](../../src/lib/relations.ts) `computeRelations`, [streamers/[id]/page.tsx](../../src/app/streamers/[id]/page.tsx) 요청마다
- 영웅 티어·맵별 승률 — hero-tier.ts·map-stats.ts, 동일 패턴

공통적으로 매 페이지 로드마다 `getStreamers()` + `getMatches()`로 **컬렉션을 통째로 읽어** 메모리에서 집계한다.

## 결정

스파이크 운영 직전, 아래 순서로 **읽기 수**를 줄인다. (병목은 CPU 집계가 아니라 Firestore 문서 읽기 수다.)

1. **서버 캐싱 / ISR 우선.** 티어·영웅·맵 집계를 서버에서 1회 계산해 캐시하고 N명에게 재사용한다. Next `revalidate`(예: 60초)로 읽기를 1/N 수준으로 낮춘다.
2. **사전집계 문서.** 집계 결과를 `stats/current` 같은 단일 문서에 저장하고, 방문자는 그 1문서만 읽는다(전체 매치 미열람). 경기 등록 시점에만 재집계해 갱신한다.
3. **Blaze 전환.** 위로도 Spark 한도가 모자라면 종량제 Blaze로 올린다.

## 이유

- 방문 1회 = 매치·스트리머 전체 읽기. 천 명 × 수백 문서 → **Spark 일 5만 읽기 한도를 즉시 초과** → quota 차단 또는 과금.
- 데이터가 작아 집계 CPU는 가볍다. 줄여야 할 것은 읽기 수이므로, 캐싱·사전집계가 가장 효과적이고 코드 변경도 작다.
- 평상시(유휴)에는 무비용을 유지해야 하므로, 상시 인프라 증설이 아니라 **스파이크 직전 토글** 방식으로 둔다.

## 구현 내용 (1순위 적용 완료)

### 추가된 함수 (`src/lib/firestore.ts`)

- **`getPrecomputedStats()`**: `stats/current` 문서 1개 읽기. 없으면 `null` 반환.
- **`refreshStats()`**: 전체 데이터 재집계 후 `stats/current`에 저장. 실패해도 throw하지 않고 에러만 로깅 (경기 저장은 영향 없음).

### 갱신 트리거

`addMatch`, `deleteMatch`, `updateMatch`, `addStreamer`, `deleteStreamer` 각 함수 마지막에 `void refreshStats()` 추가 — fire-and-forget.

### 홈 페이지 (`src/app/page.tsx`)

`stats/current` 존재 시 → 1 read로 즉시 표시 후 return.  
없을 시 → 기존 전체 컬렉션 읽기로 폴백 (초기 배포, 집계 전 상태).

### reads 비교

| 상황 | 기존 | 변경 후 |
|------|------|---------|
| 방문자 1명 (홈) | ~120 reads | 1 read |
| 방문자 1,000명 | ~120,000 reads | ~1,000 reads |
| 경기 1건 등록 | 0 | +120 reads (재집계, 1회성) |

### 알려진 한계

- 경기 등록과 `stats/current` 갱신 사이 쓰기 실패 시 일시적 불일치 가능 (다음 변경 시 자동 복구).
- 큐레이션 탭은 `CurationTierTab` 내부에서 별도 로드하므로 이 최적화 범위 밖.

## 잔여 과제

- Vercel Hobby 대역폭(월 100GB) 트래픽 급증 시 점검.
- 큐레이션 탭도 읽기 최적화가 필요하면 lazy loading 또는 사전집계 범위 확장.
