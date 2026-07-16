# ADR-0021 — 큐레이션 탭·상세 페이지 잔여 Firestore 읽기 제거

- **날짜**: 2026-07-16
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0006(홈 stats/current), ADR-0012(프로필 stats/current 확장), ADR-0013(경기기록 서버 컴포넌트), ADR-0016(큐레이션 탭 캐시 버그 수정)

## 발단

스크림 기능 작업 중 "Firestore 읽기 한도가 불안해 보인다"는 지적으로 전 기능 읽기 경로를 재점검.
ADR-0006 잔여 과제("큐레이션 탭도 읽기 최적화 필요")와 ADR-0016 수정 이후에도 남아있던
`getMatches()` 호출, 그리고 캐시가 아예 안 걸려 있던 상세 페이지 두 곳을 확인.

## 발견한 병목

### 1. 큐레이션 탭 — 방문자마다 매치 전체 재읽기 (지배적 병목)

메인 페이지(`/`) 기본 탭이 큐레이션인데, `CurationTierTab`이 자체 `useEffect`에서
`getMatches()`로 매치 컬렉션 전체(M건)를 읽어 `deriveFineRole(matches, id)`로
스트리머별 세분 역할군(탱커/원거리 암살자 등, 필터 칩·카드 표시용)을 즉석 계산하고 있었다.
ADR-0016에서 `getStreamers({fresh:true})` 오남용과 캐시 스킵 버그는 고쳤지만
`getMatches()` 자체는 그대로 남아, 방문자 1명 = `S(스트리머) + M(매치) + 2(curatedTiers류)` 읽기가 발생했다.

방문 1,000명·M=150·S=30 가정 시 하루 **~183,000 reads** — Spark 무료 한도(50,000)의 3.7배.

### 2. `/matches/[id]` — 캐시 완전 미적용

ADR-0013에서 `/matches` 목록은 서버 컴포넌트 + `unstable_cache`로 전환했지만
경기 상세 페이지(`/matches/[id]`)는 그대로 `getStreamers()` + `getMatches()`를 매 요청마다
직접 호출 — 뷰 1회 = `S + M` 읽기, 서버 렌더인데도 캐시 이득이 전혀 없는 상태였다.

### 3. 프로필 페이지 — 서버 unstable_cache 미적용

ADR-0012에서 `stats/current`(+ `profiles` 서브컬렉션) 사전집계로 프로필 페이지를 2 read로 줄였지만,
그 2 read(`getPrecomputedStats()`, `getPrecomputedProfile(id)`) 자체엔 서버 캐시가 없었다.
`isClient` 가드가 있는 모듈 변수 캐시라 서버 컴포넌트에서는 매 요청마다 무조건 Firestore를 다시 쳤다.
게다가 `stats/current`는 API 라우트가 아니라 `refreshStats()` 백그라운드 집계가 실제 쓰기 시점이라,
`revalidateTag('stats')`를 걸 자리가 아예 없었다 — 매치·스트리머 API 라우트의 `revalidateTag`는
이 문서를 안 건드리기 때문.

## 결정 — 세 곳 모두 "기존 사전집계 재사용 + 서버 캐시 추가"로 해결

새로운 사전집계 문서를 만들지 않고, **이미 있는 `stats/current`를 더 적극적으로 재사용**하는 방향으로
갔다. 새 인프라 없이 코드 변경만으로 끝나기 때문.

### 1. 큐레이션 탭 — matches 대신 fineRole 맵

`stats/current.playerStats[].fineRole`은 `refreshStats()`가 이미 계산해서 저장하고 있었다
(`calcPlayerStats` → `deriveFineRole` 호출, [tier.ts](../../src/lib/tier.ts)).
즉 큐레이션 탭이 필요한 값은 **이미 페이지가 읽어둔 데이터 안에 있었다** — 별도로 매치를 다시
읽어 즉석 계산할 이유가 없었다.

```ts
// src/lib/curated-tier.ts — matches: Match[] 파라미터를 fineRoleOf 맵으로 교체
export function buildCuratedPlayers(
  streamers: Streamer[],
  lists: CuratedTierLists,
  fineRoleOf: Map<string, FineRole | undefined>,  // 기존: matches: Match[]
): CuratedPlayer[] { /* deriveFineRole(matches, id) → fineRoleOf.get(id) */ }
```

```tsx
// src/components/curation-tier-tab.tsx
// - getMatches() 호출·matchesProp·matchList state 전부 제거
// + playerStats prop 추가, useMemo로 Map 구성
const fineRoleOf = useMemo(
  () => new Map(playerStats.map((p) => [p.streamerId, p.fineRole])),
  [playerStats],
);
```

```tsx
// src/app/page.tsx — 이미 로드해둔 stats(Elo 탭과 공유)를 그대로 넘김
<CurationTierTab streamers={streamers} playerStats={stats} />
```

부수 정리: `page.tsx`의 `matches`/`setMatches` state가 이 prop 전달 외엔 안 쓰이고 있었던 걸 확인하고
같이 제거(폴백 경로의 지역 변수로만 남김).

### 2. `/matches/[id]` — `firestore.server.ts` 캐시 재사용

목록 페이지가 이미 `unstable_cache(getMatches, ['matches'], {tags:['matches']})`로 캐시해둔
엔트리를 상세 페이지도 그대로 공유하도록 함수 하나만 추가. 목록용 `getMatchesCachedServer()`는
페이로드 축소를 위해 `blueStats`/`redStats`를 제거하고 반환하므로 그대로는 못 쓰고,
같은 캐시 원본에서 스탯 포함 단건을 찾는 함수를 별도로 뺐다.

```ts
// src/lib/firestore.server.ts
export async function getMatchCachedServer(id: string): Promise<Match | null> {
  const raw = await _getMatchesRaw() as RawMatch[];  // 목록과 같은 캐시 엔트리, 추가 read 없음
  const m = raw.find((r) => r.id === id);
  if (!m) return null;
  return { ...m, date: new Date(m.date), createdAt: new Date(m.createdAt) };
}
```

`/matches/[id]/page.tsx`는 `getStreamers()+getMatches()` 직접 호출을
`getStreamersCachedServer()+getMatchCachedServer(id)`로 교체.

### 3. 프로필 페이지 — stats 전용 서버 캐시 + refreshStats에서 무효화

```ts
// src/lib/firestore.server.ts
const _getPrecomputedStatsRaw = unstable_cache(
  () => getPrecomputedStats(), ['stats-current'], { tags: ['stats'] },
);
const _getPrecomputedProfileRaw = unstable_cache(
  (streamerId: string) => getPrecomputedProfile(streamerId), ['stats-profile'], { tags: ['stats'] },
);
export const getPrecomputedStatsCachedServer = _getPrecomputedStatsRaw;
export const getPrecomputedProfileCachedServer = _getPrecomputedProfileRaw;
```

```ts
// src/lib/firestore-admin.ts — refreshStats() 배치 커밋 직후
await batch.commit();
revalidateTag('stats', 'max');  // 신규: stats/current 실제 쓰기 시점이 여기라 여기서 무효화해야 함
```

`/streamers/[id]/page.tsx`는 `getPrecomputedStats()/getPrecomputedProfile(id)` 호출을
`getPrecomputedStatsCachedServer()/getPrecomputedProfileCachedServer(id)`로 교체.

## reads 비교

| 페이지 | 수정 전 (방문 1회) | 수정 후 (방문 1회, 캐시 히트) |
|---|---|---|
| 큐레이션 탭 (홈 기본 탭) | S + M + 2 | S + 2 (매치 읽기 완전 제거) |
| `/matches/[id]` | S + M | **0** (다음 갱신까지) |
| `/streamers/[id]` | 2 | **0** (다음 stats 갱신까지) |

M=150 기준으로 보면 큐레이션 탭 하나가 방문자당 150 reads를 절감 — 세 항목 중 가장 큰 비중.
나머지 두 곳은 애초에 방문당 절대량은 작았지만 캐시가 전혀 없어 방문자 수에 그대로 비례하던 것을
캐시 히트 시 0으로 만듦.

## 알려진 한계 / 트레이드오프

- **큐레이션 탭 잔여 읽기(S+2)**: `CurationTierTab`이 여전히 자체 `useEffect`에서
  `getStreamers()` + `getCuratedTierLists()` + `getCuratedTierLastEditByAdmin()`를 호출.
  마지막 두 개는 사실 같은 문서(`curatedTiers/current`)를 두 번 읽는 비효율도 남아있음 —
  다음에 손볼 때 하나로 합칠 수 있음.
- **신선도 지연**: `stats/current` 캐시가 걸린 상태에서 경기/스트리머를 입력하면
  `refreshStats()` 완료 + `revalidateTag('stats')` 시점까지 짧은 지연(보통 수 초) 후 반영.
  운영자 본인이 입력 직후 확인할 때만 체감 가능한 수준이며, 시청자 경험엔 영향 없음.
- **`/matches/[id]` 캐시 무효화 단위**: 매치 컬렉션 전체가 하나의 캐시 엔트리(`tags:['matches']`)라
  아무 경기 하나만 바뀌어도 전체가 무효화된다. 경기 수가 수천 단위로 늘면 재검토 대상.

## 잔여 과제 — 다음에 손볼 것 (우선순위순)

1. **큐레이션 탭 자체 fetch 제거 (홈 페이지 서버 컴포넌트 전환)** — 지금 `/`는 통째로
   `'use client'`라 `CurationTierTab`이 마운트 후 브라우저에서 직접 Firestore를 친다.
   `/matches`(ADR-0013)·`/streamers/[id]`(ADR-0012, 이번 ADR)와 같은 패턴으로:
   - 서버에서 `getStreamersCachedServer()` + `getPrecomputedStatsCachedServer()`로 미리 fetch
   - 드래그앤드롭 편집·탭 전환 등 상호작용은 클라이언트 컴포넌트(`CurationTierTab` 자체)에 그대로 두고,
     데이터만 서버가 props로 내려줌
   - 기대 효과: 방문자당 읽기 S+2 → **0** (캐시 무효화 직후 첫 방문자만 1회), 로딩 스켈레톤도 사라짐
   - 작업량: 홈 페이지 전체를 서버/클라이언트 경계로 쪼개야 해서 이번 세 건보다 큼.
     현재 상태(S+2, S~30 가정 시 방문자당 32 reads)로도 방문 수백~천 단위까진 안전해 급하지 않음.
2. **큐레이션 탭 내부 중복 읽기 정리** — `getCuratedTierLists()` + `getCuratedTierLastEditByAdmin()`가
   둘 다 `curatedTiers/current` 문서를 각각 읽음. 하나로 합치면 방문자당 1 read 추가 절감(작음).
3. **Blaze 전환 안전망** — 위 최적화들과 별개로, 예산 알람($5) 걸고 Blaze로 전환해두면
   어떤 경로로든 폭주해도 과금만 소액 발생하고 서비스가 죽지 않음. ADR-0012에서도 동일하게 권장했던 항목.

## 구현 파일 목록

| 파일 | 변경 |
|---|---|
| `src/lib/curated-tier.ts` | `buildCuratedPlayers`: `matches: Match[]` → `fineRoleOf: Map<string, FineRole\|undefined>` |
| `src/components/curation-tier-tab.tsx` | `getMatches()` 제거, `playerStats` prop 추가, `fineRoleOf` useMemo |
| `src/app/page.tsx` | `<CurationTierTab matches={matches}>` → `<CurationTierTab playerStats={stats}>`, 미사용 `matches`/`setMatches` state 제거 |
| `src/lib/firestore.server.ts` | `getMatchCachedServer`, `getPrecomputedStatsCachedServer`, `getPrecomputedProfileCachedServer` 신규 |
| `src/app/matches/[id]/page.tsx` | 캐시 없는 직접 호출 → `firestore.server.ts` 캐시 함수 사용 |
| `src/app/streamers/[id]/page.tsx` | 동일 |
| `src/lib/firestore-admin.ts` | `refreshStats()` 배치 커밋 후 `revalidateTag('stats', 'max')` 추가 |
| `src/lib/__tests__/curated-tier.test.ts` | `buildCuratedPlayers` 신규 시그니처(맵)로 테스트 갱신 + fineRole 반영 케이스 추가 |
