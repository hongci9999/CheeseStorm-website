# ADR-0009 반응형 디자인 전략

- **날짜**: 2026-06-14
- **상태**: 채택

## 맥락

전체 코드베이스가 `style={{}}` 인라인 스타일로 작성되어 있고 `@media` 쿼리가 전무하다. Honeycomb(`Honeycomb` 컴포넌트)과 프로필 사이드바(`310px 1fr` 그리드)는 고정 픽셀 기반이라 768px 미만에서 레이아웃이 깨진다. 타겟 사용자는 스트리밍 시청자(모바일)와 운영자/스트리머(데스크톱)로 나뉘며, **모바일에서는 읽기 전용** — 경기 입력·편집은 데스크톱 전용으로 범위를 제한한다.

## 결정

### 브레이크포인트 (2단계)

| 이름 | 값 | 해당 구간 |
|---|---|---|
| `bp-md` | 768px | mobile < 768px, tablet 768–1023px |
| `bp-lg` | 1024px | desktop ≥ 1024px |

### 구현 방식 — `useBreakpoint()` 훅 단독

CSS `@media` 대신 JS 훅으로 `'mobile' | 'tablet' | 'desktop'` 값을 반환한다.

**이유**: Honeycomb 컴포넌트의 `CARD_HEX`·`STEP_X`·`ROW_FULL`이 JS 상수로 계산되므로, CSS만으로는 반응형 처리가 불가능하다. 어차피 JS 훅이 필수인 이상 `@media`와 혼용하면 스타일 관리 지점이 둘로 분산된다 — 훅 하나로 통일한다.

**기각 — CSS `@media` 혼용**: 단순 패딩·폰트 크기는 CSS로 처리할 수 있으나, Honeycomb·Profile 그리드와 일관성이 깨진다.

### 화면별 레이아웃 규칙

| 컴포넌트 | mobile (<768px) | tablet (768–1023px) | desktop (≥1024px) |
|---|---|---|---|
| **SiteHeader** | 로고+테마토글만 (쓰기 CTA 숨김) | ← | 현재 전체 |
| **BottomTabBar** (신규) | 하단 고정 4탭 | 하단 고정 4탭 | 미표시 |
| **Honeycomb** | `CARD_HEX=120`, 2열 | `CARD_HEX=160`, 3열 | `CARD_HEX=200`, 5열 |
| **프로필 페이지** | 단일 칼럼 (프로필카드→탭) | 단일 칼럼 | `310px 1fr` 그리드 |
| **MatchRow** | 영웅스택 축소, 맵·날짜 유지 | ← | 현재 전체 |
| **쓰기 기능 (FAB·편집버튼)** | 숨김 | 숨김 | 노출 |

## 영향 범위

| 파일 | 변경 |
|---|---|
| `src/hooks/use-breakpoint.ts` | 신규 |
| `src/components/site-header.tsx` | mobile 단순화 |
| `src/components/bottom-tab-bar.tsx` | 신규 |
| `src/app/layout.tsx` | BottomTabBar 삽입, 하단 패딩 |
| `src/app/streamers/page.tsx` | Honeycomb 동적 크기 |
| `src/app/streamers/[id]/page.tsx` | 그리드 → 단일 칼럼 |
| `src/app/matches/page.tsx` | MatchRow 모바일 축소 |
| `src/app/page.tsx` | TierRow 티어 칼럼 너비 반응형 |
| `src/styles/tokens/spacing.css` | `--bp-md`, `--bp-lg` 토큰 추가 |
