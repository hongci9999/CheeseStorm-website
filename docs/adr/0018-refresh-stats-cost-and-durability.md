# ADR-0018 — refreshStats 재집계 비용과 백그라운드 내구성

- **날짜**: 2026-06-26
- **상태**: 부분 채택 — 옵션 1(낙관적 삭제) + 옵션 2(`after()` 내구성) 구현. 옵션 3·4 보류(YAGNI)
- **관련**: ADR-0015 (refreshStats Admin SDK reads), ADR-0012 (프로필 read 최적화)

## 증상

경기를 수정·추가·삭제하면 반영까지 체감상 수 초 걸린다.

## 구조

모든 뮤테이션(`addMatch`/`updateMatch`/`deleteMatch`, 스트리머 변경)은
끝에 `void refreshStats()`를 fire-and-forget로 호출한다.

```ts
// firestore-admin.ts::updateMatch
await getAdminDb().collection('matches').doc(id).update(payload);
void refreshStats();   // ← await 안 함, 응답 즉시 반환
```

`refreshStats()`가 매 호출마다 하는 일:

1. 전체 `matches` + 전체 `streamers`를 Firestore에서 재读 (Admin SDK)
2. `calcPlayerStats` 전 스트리머 통계 재계산
3. `calcHeroTiers` 전 영웅 티어 재계산
4. **스트리머 N명 루프** — 각자
   `computeRelations`(O(M)), `aggregateHeroStats`, `mapWinRates`,
   `kdaFor`, `fineRoleAffinity`, 전 경기 패킹
5. `stats/current` 단일 문서에 `playerStats`+`heroTiers`+`profiles` 통째 쓰기

## 병목 분석

| 후보 | 비용 | 비고 |
| ---- | ---- | ---- |
| 연산 (2~4) | 수 ms | N≈30, M≈200 기준 O(N×M)이라도 JS로 무시 가능 |
| Firestore 재读 (1) | 네트워크 왕복 | 매 수정마다 전체 컬렉션 읽기. Spark 레이턴시 |
| stats/current 쓰기 (5) | profiles 전체 직렬화 | 문서 1개가 커질수록 증가 |

→ **CPU가 아니라 I/O가 병목.** N×M 연산 최적화는 현 규모에선 헛수고.

## 추가 문제 — fire-and-forget 내구성

Vercel(Lambda 기반) 서버리스는 **응답 반환 = 함수 동결/종료**.
`void refreshStats()`는 응답을 기다리지 않으므로, 응답 후 컨테이너가
얼거나 재활용되면 재집계가 **Firestore 쓰기 전에 잘릴 수 있다**.

결과: 경기는 수정됐는데(await됨) `stats/current`는 옛 값 그대로 →
티어/통계 **불일치**. 확률은 낮지만 보장은 없다.

## 개선 옵션 (게으른 순)

### 1. 클라이언트 낙관적 갱신 — 권장, 최소 변경
체감 지연 대부분은 클라가 `stats/current` 재집계 완료를 기다리는 것.
수정한 경기만 로컬 상태에 즉시 반영하고 티어 숫자는 다음 새로고침에
따라오게 한다. 코드 적고 효과 큼.

### 2. `waitUntil()`로 백그라운드 보장 — 내구성 해결
`@vercel/functions`의 `waitUntil(refreshStats())`로 교체하면 응답은
빠르게 반환하되 런타임이 백그라운드 작업 완료를 보장. fire-and-forget
누락 위험 제거. 코드 거의 안 늘음.

### 3. refreshStats 디바운스/큐
연속 수정(여러 판 일괄 편집) 시 매번 전량 재집계 → 마지막 1회만.
타임아웃/큐 필요. 일괄 작업이 잦을 때만 값어치.

### 4. 증분 집계 — YAGNI
바뀐 경기의 델타만 기존 stats에 반영. 전체 재读·재계산 제거.
진짜 엔지니어링이고 버그 위험 큼. 경기 수천 규모 전엔 불필요.

## 추천

- **지금**: 옵션 1(낙관적 갱신) + 옵션 2(`waitUntil`). 둘 다 디아 작고
  체감 지연·데이터 누락 위험을 같이 잡음.
- **나중**: 데이터가 커지면 옵션 3, 그 다음에야 옵션 4.

## 측정 먼저

옵션 1 정확히 적용하려면 클라 수정 흐름(저장 후 무엇을 기다리는지)과
실제 소요 시간(재读 vs 쓰기 비중)을 먼저 측정할 것. 추정으로 옵션 4부터
손대지 말 것.
