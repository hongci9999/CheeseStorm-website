# ADR-0019 — 큐레이션 티어 수정 이력 로그

- **날짜**: 2026-06-26
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0015 (refreshStats Admin SDK), ADR-0016 (큐레이션 캐시·드래그)

> 개발자 내부 기록용. 사용자 노출 문서(README, guide 페이지, CLAUDE.md)에는
> 의도적으로 남기지 않는다.

## 배경

큐레이션(수동) 티어표는 `curatedTiers/current` 단일 문서에
`set(..., merge:true)`로 덮어써 왔다. `updatedAt` 타임스탬프 하나만 남아
**누가·언제·무엇을 바꿨는지 추적 불가**했다.

운영자(개발자) 본인이 변경 이력을 사후 확인하고 싶다는 요구.
사용자 노출 UI는 불필요 — 로그만 남으면 된다.

## 결정

저장 시 `curatedTiersHistory` 컬렉션에 append-only 로그를 남긴다.

```ts
// src/lib/firestore-admin.ts :: saveCuratedTierLists(lists, editor?)
await db.collection('curatedTiersHistory').add({
  editedBy:     editor?.chzzkId ?? '(system)',
  editedByName: editor?.name    ?? '(시스템 자동 정리)',
  editedAt:     FieldValue.serverTimestamp(),
  changes,   // 이전↔새 배치 diff
});
```

### changes diff

저장 직전 현재 문서 + 스트리머 이름 맵을 읽어 티어가 바뀐 스트리머만 추린다.

```ts
changes: { streamerId: string; name: string; from: string; to: string }[]
// 예) [{ streamerId:'s1', name:'철수', from:'S', to:'A' },
//      { streamerId:'s3', name:'민수', from:'(미배정)', to:'D' }]
```

- 안 바뀐 스트리머는 기록 안 함
- 신규 배치 `(미배정) → 티어`, 제거 `티어 → (미배정)`
- `tierByStreamer`로 티어별 ID 목록을 ID→티어 맵으로 뒤집어 비교

### 수정자 출처

`/api/curated-tiers` PUT 라우트가 `requireRole('streamer')` 세션에서
`{ chzzkId, name }`을 `saveCuratedTierLists`로 전달.
`removeCuratedPlacement`(스트리머 삭제 시 자동 정리)는 editor 없이 호출 →
`(system)` / `(시스템 자동 정리)`로 기록.

## 확인 방법

Firebase 콘솔 → Firestore → `curatedTiersHistory` →
`editedAt` 내림차순. 별도 조회 API·페이지 없음.

## 비용

저장마다 read 2회(현재 문서 + 스트리머 컬렉션) + write 2회(current + history).
수동 티어 저장은 드물어 무시 가능 (Spark 한도 영향 미미).

## 보류 (YAGNI)

- **조회 UI**: 콘솔로 충분. 운영자가 자주 본다면 admin 전용 API+페이지 추가.
- **lists 전체 스냅샷**: diff만 기록. 롤백 기능 필요해지면 사본 추가.
- **history 보관 한도/TTL**: 문서 수 누적되면 정리 정책 필요. 현재 미적용.

## 자가 검증

`diffTierChanges`는 firebase-admin import 때문에 vitest에서 격리 곤란 →
순수 함수 복제로 standalone assert 검증 (S→A 이동, 신규 배치, 미변경 제외,
이름 resolve). 통과 확인.
