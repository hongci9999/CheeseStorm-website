# 모의 밴픽 (Mock Draft) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 치지직 HotS 대회용 모의 밴픽 시뮬레이터(`/mock-draft`)를 구현한다 — 시리즈(Bo3/Bo5) 연속 진행, 3종 드래프트(일반/소프트/하드 피어리스), 픽↔플레이어 바인딩, 맵 중복 금지, localStorage 저장.

**Architecture:** 순수 함수 엔진(`src/lib/draft/`)이 드래프트 순서·피어리스 필터·맵 필터·상태 전이를 담당하고 Vitest로 검증한다. 클라이언트 페이지(`src/app/mock-draft/`)는 엔진을 호출해 렌더만 한다. 저장은 localStorage 한 키.

**Tech Stack:** TypeScript, Next.js 15 App Router (client component), Vitest, Tailwind v4 (인라인 스타일 관례 따름), 기존 `heroes.ts`/`hero-image.ts` 재사용.

## Global Constraints

- 코멘트는 한국어, 함수·변수는 영어 camelCase, 파일명은 kebab-case (Next.js 페이지는 `page.tsx` 고정).
- 저장은 **localStorage 단일 키** `cheesestorm.mockdraft.v1`. Firestore/서버 미사용, 인증 불필요.
- 드래프트 16스텝 순서(선픽 팀 F 기준): `ban:F, ban:S, ban:F, ban:S, pick:F, pick:S, pick:S, pick:F, pick:F, ban:F, ban:S, pick:S, pick:S, pick:F, pick:F, pick:S`.
- 밴 팀당 3, 픽 팀당 5. 먼저 고른 쪽 우선권(픽 순서 없음).
- 피어리스 잠금: 일반=없음 / 하드=이전 세트 누구든 픽한 영웅 전역 제외 / 소프트=그 픽 배정 플레이어가 이전 세트 픽한 영웅만 제외(밴 무제약).
- 맵 15종은 단일 출처 `src/lib/draft/maps.ts`. 시리즈 내 이전 세트 사용 맵은 재선택 불가.
- 영웅 그리드는 slug 기준 중복 제거된 캐노니컬 목록만 사용(별칭 중복 금지).
- 로스터 팀당 정확히 5명일 때만 세트 시작 가능.
- 테스트 실행: `npx vitest run <파일>`. 빌드: `npm run build`.

---

## File Structure

**생성:**
- `src/lib/draft/maps.ts` — `HOTS_MAPS` 상수(이전), `availableMaps()`.
- `src/lib/draft/types.ts` — `Team, DraftType, Player, Series, SetResult, DraftState, Step`.
- `src/lib/draft/sequence.ts` — `buildSequence()`.
- `src/lib/draft/engine.ts` — 상태 전이 + `availableHeroes()`.
- `src/lib/draft/storage.ts` — localStorage 로드/저장.
- `src/lib/draft/__tests__/maps.test.ts`, `sequence.test.ts`, `engine.test.ts`, `storage.test.ts`.
- `src/app/mock-draft/page.tsx` — 클라이언트 페이지(상태 오케스트레이션).
- `src/components/mock-draft/series-setup.tsx` — 종류·Bo·로스터 구성.
- `src/components/mock-draft/draft-board.tsx` — 팀 슬롯 + 현재 스텝 배너 + 플레이어 선택.
- `src/components/mock-draft/hero-grid.tsx` — 역할 필터 + 검색 + 영웅 타일.
- `src/components/mock-draft/scoreboard.tsx` — 세트 스코어 + 클린치.
- `src/components/mock-draft/pick-history.tsx` — 플레이어별 세트 이력.

**수정:**
- `src/lib/hero-image.ts` — `CANONICAL_HEROES` export 추가.
- `src/app/matches/new/page.tsx:23-27,612` — 로컬 `HOTS_MAPS` 제거, `@/lib/draft/maps`에서 import.
- `src/components/site-header.tsx:45-48` — `NAV_ITEMS`에 `/mock-draft` 추가.
- `src/components/bottom-tab-bar.tsx:8-11` — `TAB_ITEMS`에 `/mock-draft` 추가.

---

### Task 1: 맵 상수 이전 + `availableMaps`

**Files:**
- Create: `src/lib/draft/maps.ts`
- Create: `src/lib/draft/__tests__/maps.test.ts`
- Modify: `src/app/matches/new/page.tsx:23-27` (상수 제거), `:612` (import 사용)

**Interfaces:**
- Consumes: 없음.
- Produces: `HOTS_MAPS: readonly string[]`, `availableMaps(usedMaps: string[]): string[]`.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/draft/__tests__/maps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOTS_MAPS, availableMaps } from '../maps';

describe('maps', () => {
  it('HOTS_MAPS는 전장 15종', () => {
    expect(HOTS_MAPS).toHaveLength(15);
    expect(HOTS_MAPS).toContain('용의 둥지');
  });

  it('availableMaps는 사용된 맵을 제외', () => {
    const result = availableMaps(['용의 둥지', '하늘 사원']);
    expect(result).not.toContain('용의 둥지');
    expect(result).not.toContain('하늘 사원');
    expect(result).toHaveLength(13);
  });

  it('사용된 맵이 없으면 전체 반환', () => {
    expect(availableMaps([])).toHaveLength(15);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/draft/__tests__/maps.test.ts`
Expected: FAIL — `Cannot find module '../maps'`.

- [ ] **Step 3: 구현**

`src/lib/draft/maps.ts`:

```ts
// 히어로즈 오브 더 스톰 전장 15종 — 최근 출시일 순(최신 → 오래된 순). 단일 출처.
export const HOTS_MAPS: readonly string[] = [
  '알터랙 고개', '볼스카야 공장', '하나무라 사원', '핵탄두 격전지', '브락시스 항전',
  '파멸의 탑', '불지옥 신단', '영원의 전쟁터', '거미 여왕의 무덤', '하늘 사원',
  '공포의 정원', '죽음의 광산', '저주받은 골짜기', '용의 둥지', '블랙하트 항만',
];

// 시리즈에서 아직 안 쓴 맵만 반환 (맵 중복 금지).
export function availableMaps(usedMaps: string[]): string[] {
  const used = new Set(usedMaps);
  return HOTS_MAPS.filter((m) => !used.has(m));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/draft/__tests__/maps.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: matches/new에서 로컬 상수 제거하고 import 교체**

`src/app/matches/new/page.tsx` 상단 import 블록에 추가:

```ts
import { HOTS_MAPS } from '@/lib/draft/maps';
```

`src/app/matches/new/page.tsx:22-27`의 로컬 선언 삭제:

```ts
// 삭제 대상 (기존 22~27줄)
// 히어로즈 오브 더 스톰 전장 15종 — 최근 출시일 순(최신 → 오래된 순)
const HOTS_MAPS = [
  '알터랙 고개','볼스카야 공장','하나무라 사원','핵탄두 격전지','브락시스 항전',
  '파멸의 탑','불지옥 신단','영원의 전쟁터','거미 여왕의 무덤','하늘 사원',
  '공포의 정원','죽음의 광산','저주받은 골짜기','용의 둥지','블랙하트 항만',
];
```

612줄의 `{HOTS_MAPS.map(...)}` 사용부는 그대로 둔다(이제 import된 상수 참조).

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공(타입 에러 없음).

- [ ] **Step 7: 커밋**

```bash
git add src/lib/draft/maps.ts src/lib/draft/__tests__/maps.test.ts src/app/matches/new/page.tsx
git commit -m "feat: 맵 상수를 lib/draft/maps로 이전하고 availableMaps 추가"
```

---

### Task 2: 캐노니컬 영웅 목록

**Files:**
- Modify: `src/lib/hero-image.ts` (끝에 export 추가)
- Test: `src/lib/__tests__/hero-image.test.ts` (신규)

**Interfaces:**
- Consumes: 기존 `HERO_SLUG`(모듈 내부), `HERO_SLUGS`.
- Produces: `CANONICAL_HEROES: string[]` — slug당 대표 한국어명 1개, 가나다순. 별칭 중복 없음.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/__tests__/hero-image.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CANONICAL_HEROES, HERO_SLUGS, heroImageUrl } from '../hero-image';
import { roleOfHero } from '../heroes';

describe('CANONICAL_HEROES', () => {
  it('slug 개수만큼 존재(별칭 중복 제거)', () => {
    expect(CANONICAL_HEROES).toHaveLength(HERO_SLUGS.length);
    expect(new Set(CANONICAL_HEROES).size).toBe(CANONICAL_HEROES.length);
  });

  it('모든 영웅이 역할군 매핑을 가진다', () => {
    for (const name of CANONICAL_HEROES) {
      expect(roleOfHero(name), `${name} 역할군 없음`).not.toBeNull();
    }
  });

  it('모든 영웅이 이미지 URL을 가진다', () => {
    for (const name of CANONICAL_HEROES) {
      expect(heroImageUrl(name), `${name} 이미지 없음`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/hero-image.test.ts`
Expected: FAIL — `CANONICAL_HEROES` is not exported.

- [ ] **Step 3: 구현**

`src/lib/hero-image.ts` 맨 끝(`HERO_SLUGS` 선언 뒤)에 추가:

```ts
// slug 기준 중복 제거한 캐노니컬 영웅명 목록 (별칭 제외, 각 slug의 첫 표기 사용, 가나다순).
// 드래프트 영웅 그리드 등 "영웅 1종 = 항목 1개"가 필요한 곳에서 사용.
export const CANONICAL_HEROES: string[] = (() => {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const [name, slug] of Object.entries(HERO_SLUG)) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b, 'ko'));
})();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/hero-image.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/hero-image.ts src/lib/__tests__/hero-image.test.ts
git commit -m "feat: slug 중복 제거한 CANONICAL_HEROES 목록 추가"
```

---

### Task 3: 드래프트 타입 정의

**Files:**
- Create: `src/lib/draft/types.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: `Team, DraftType, Player, SetResult, DraftState, Series, Step` 타입.

이 태스크는 타입만 정의하며(런타임 코드 없음) sequence/engine 태스크에서 소비·검증된다. 별도 테스트 없음.

- [ ] **Step 1: 타입 파일 작성**

`src/lib/draft/types.ts`:

```ts
// 모의 밴픽 도메인 타입.

export type Team = 'blue' | 'red';
export type DraftType = 'normal' | 'soft' | 'hard';

export interface Player {
  id: string;        // DB 스트리머 id, 또는 수동 추가 시 'manual:<uuid>'
  name: string;
  imageUrl?: string; // DB 스트리머면 profileImageUrl
}

// [playerId, 영웅명] 픽 한 건.
export type Pick = [playerId: string, hero: string];

// 완료된 세트 결과.
export interface SetResult {
  map: string;
  firstPick: Team;
  winner: Team;
  bans: Record<Team, string[]>;   // 영웅명
  picks: Record<Team, Pick[]>;
}

// 진행 중 세트 상태.
export interface DraftState {
  map: string;
  firstPick: Team;
  cursor: number;                 // 0..16 (16이면 완료)
  bans: Record<Team, string[]>;
  picks: Record<Team, Pick[]>;
}

// 시리즈 전체 (localStorage에 직렬화되는 루트).
export interface Series {
  draftType: DraftType;
  bestOf: 3 | 5;
  blue: Player[];                 // 길이 5
  red: Player[];                  // 길이 5
  sets: SetResult[];              // 완료된 세트
  current: DraftState | null;     // 진행 중 세트(없으면 세트 셋업 대기)
}

export interface Step {
  kind: 'ban' | 'pick';
  team: Team;
}
```

- [ ] **Step 2: 타입 체크(빌드 대신 tsc noEmit)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음(새 파일이 아직 아무 데서도 import되지 않아도 통과).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/draft/types.ts
git commit -m "feat: 모의 밴픽 도메인 타입 정의"
```

---

### Task 4: 드래프트 순서 시퀀스

**Files:**
- Create: `src/lib/draft/sequence.ts`
- Test: `src/lib/draft/__tests__/sequence.test.ts`

**Interfaces:**
- Consumes: `Team, Step` (types.ts).
- Produces: `buildSequence(firstPick: Team): Step[]` — 길이 16.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/draft/__tests__/sequence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSequence } from '../sequence';
import type { Step } from '../types';

const kinds = (s: Step[]) => s.map((x) => x.kind).join(',');
const teams = (s: Step[]) => s.map((x) => x.team).join(',');

describe('buildSequence', () => {
  it('16스텝: 밴6 + 픽10', () => {
    const seq = buildSequence('blue');
    expect(seq).toHaveLength(16);
    expect(seq.filter((s) => s.kind === 'ban')).toHaveLength(6);
    expect(seq.filter((s) => s.kind === 'pick')).toHaveLength(10);
  });

  it('kind 순서가 규격과 일치 (선픽=blue)', () => {
    expect(kinds(buildSequence('blue'))).toBe(
      'ban,ban,ban,ban,pick,pick,pick,pick,pick,ban,ban,pick,pick,pick,pick,pick',
    );
  });

  it('team 순서가 규격과 일치 (선픽=blue, F=blue S=red)', () => {
    expect(teams(buildSequence('blue'))).toBe(
      'blue,red,blue,red,blue,red,red,blue,blue,blue,red,red,red,blue,blue,red',
    );
  });

  it('선픽=red면 F/S가 뒤바뀐다', () => {
    expect(teams(buildSequence('red'))).toBe(
      'red,blue,red,blue,red,blue,blue,red,red,red,blue,blue,blue,red,red,blue',
    );
  });

  it('팀당 밴3 / 픽5', () => {
    const seq = buildSequence('blue');
    const count = (team: string, kind: string) =>
      seq.filter((s) => s.team === team && s.kind === kind).length;
    expect(count('blue', 'ban')).toBe(3);
    expect(count('red', 'ban')).toBe(3);
    expect(count('blue', 'pick')).toBe(5);
    expect(count('red', 'pick')).toBe(5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/draft/__tests__/sequence.test.ts`
Expected: FAIL — `Cannot find module '../sequence'`.

- [ ] **Step 3: 구현**

`src/lib/draft/sequence.ts`:

```ts
import type { Team, Step } from './types';

// F(선픽 팀)/S(후픽 팀) 기준 16스텝 템플릿.
// 밴1: F S F S / 픽1: F S S F F / 밴2: S F / 픽2: S S F F S
// 미드밴(밴2)은 후픽 팀 먼저 — 초기 계획은 F S로 잘못 기재, 2026-07-17 정정.
const TEMPLATE: Array<{ kind: 'ban' | 'pick'; ref: 'F' | 'S' }> = [
  { kind: 'ban', ref: 'F' }, { kind: 'ban', ref: 'S' },
  { kind: 'ban', ref: 'F' }, { kind: 'ban', ref: 'S' },
  { kind: 'pick', ref: 'F' },
  { kind: 'pick', ref: 'S' }, { kind: 'pick', ref: 'S' },
  { kind: 'pick', ref: 'F' }, { kind: 'pick', ref: 'F' },
  { kind: 'ban', ref: 'S' }, { kind: 'ban', ref: 'F' },
  { kind: 'pick', ref: 'S' }, { kind: 'pick', ref: 'S' },
  { kind: 'pick', ref: 'F' }, { kind: 'pick', ref: 'F' },
  { kind: 'pick', ref: 'S' },
];

// 선픽 팀을 받아 실제 팀이 채워진 16스텝 시퀀스를 만든다.
export function buildSequence(firstPick: Team): Step[] {
  const F: Team = firstPick;
  const S: Team = firstPick === 'blue' ? 'red' : 'blue';
  return TEMPLATE.map(({ kind, ref }) => ({ kind, team: ref === 'F' ? F : S }));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/draft/__tests__/sequence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/draft/sequence.ts src/lib/draft/__tests__/sequence.test.ts
git commit -m "feat: 드래프트 순서 시퀀스 생성(buildSequence)"
```

---

### Task 5: 엔진 — 상태 전이

**Files:**
- Create: `src/lib/draft/engine.ts`
- Test: `src/lib/draft/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `buildSequence` (sequence.ts), `Team, DraftState, SetResult, Step` (types.ts).
- Produces:
  - `startSet(map: string, firstPick: Team): DraftState`
  - `currentStep(state: DraftState): Step | null`
  - `isComplete(state: DraftState): boolean`
  - `applyBan(state: DraftState, hero: string): DraftState`
  - `applyPick(state: DraftState, hero: string, playerId: string): DraftState`
  - `undo(state: DraftState): DraftState`
  - `finishSet(state: DraftState, winner: Team): SetResult`

이 태스크는 `availableHeroes`를 제외한 전이 함수만 구현한다(피어리스 필터는 Task 6).

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/draft/__tests__/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  startSet, currentStep, isComplete, applyBan, applyPick, undo, finishSet,
} from '../engine';
import { buildSequence } from '../sequence';
import type { DraftState } from '../types';

// 16스텝을 순서대로 소비하는 헬퍼 (밴은 hero, 픽은 hero+player).
function playThrough(state: DraftState): DraftState {
  let s = state;
  let i = 0;
  while (!isComplete(s)) {
    const step = currentStep(s)!;
    if (step.kind === 'ban') s = applyBan(s, `ban${i}`);
    else s = applyPick(s, `hero${i}`, `p${i}`);
    i++;
  }
  return s;
}

describe('engine 상태 전이', () => {
  it('startSet은 빈 상태에서 cursor 0', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(s.cursor).toBe(0);
    expect(s.map).toBe('용의 둥지');
    expect(s.firstPick).toBe('blue');
    expect(s.bans).toEqual({ blue: [], red: [] });
    expect(currentStep(s)).toEqual({ kind: 'ban', team: 'blue' });
  });

  it('applyBan은 현재 스텝 팀에 밴 추가 후 커서 전진', () => {
    const s = applyBan(startSet('용의 둥지', 'blue'), '겐지');
    expect(s.cursor).toBe(1);
    expect(s.bans.blue).toEqual(['겐지']);
    // 다음 스텝은 밴:red
    expect(currentStep(s)).toEqual({ kind: 'ban', team: 'red' });
  });

  it('픽 스텝에서 applyBan은 예외', () => {
    let s = startSet('용의 둥지', 'blue');
    // 밴4개 소비 → 첫 픽 스텝
    s = applyBan(s, 'b1'); s = applyBan(s, 'b2');
    s = applyBan(s, 'b3'); s = applyBan(s, 'b4');
    expect(currentStep(s)!.kind).toBe('pick');
    expect(() => applyBan(s, 'x')).toThrow();
  });

  it('applyPick은 [playerId, hero]를 해당 팀에 추가', () => {
    let s = startSet('용의 둥지', 'blue');
    s = applyBan(s, 'b1'); s = applyBan(s, 'b2');
    s = applyBan(s, 'b3'); s = applyBan(s, 'b4');
    // 첫 픽: 선픽 blue
    s = applyPick(s, '겐지', 'player1');
    expect(s.picks.blue).toEqual([['player1', '겐지']]);
    expect(s.cursor).toBe(5);
  });

  it('undo는 마지막 액션을 되돌린다', () => {
    let s = startSet('용의 둥지', 'blue');
    s = applyBan(s, '겐지');
    s = undo(s);
    expect(s.cursor).toBe(0);
    expect(s.bans.blue).toEqual([]);
  });

  it('cursor 0에서 undo는 무변화', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(undo(s)).toEqual(s);
  });

  it('16스텝 소비 후 isComplete', () => {
    const s = playThrough(startSet('용의 둥지', 'blue'));
    expect(isComplete(s)).toBe(true);
    expect(currentStep(s)).toBeNull();
    expect(s.picks.blue).toHaveLength(5);
    expect(s.picks.red).toHaveLength(5);
    expect(s.bans.blue).toHaveLength(3);
    expect(s.bans.red).toHaveLength(3);
  });

  it('finishSet은 완료 상태에서만 SetResult 반환', () => {
    const done = playThrough(startSet('용의 둥지', 'blue'));
    const result = finishSet(done, 'red');
    expect(result.winner).toBe('red');
    expect(result.map).toBe('용의 둥지');
    expect(result.firstPick).toBe('blue');
    expect(result.picks.blue).toHaveLength(5);
  });

  it('미완료 상태에서 finishSet은 예외', () => {
    const s = startSet('용의 둥지', 'blue');
    expect(() => finishSet(s, 'blue')).toThrow();
  });

  it('전이 함수는 입력 상태를 변형하지 않는다(불변)', () => {
    const s = startSet('용의 둥지', 'blue');
    applyBan(s, '겐지');
    expect(s.cursor).toBe(0);
    expect(s.bans.blue).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/draft/__tests__/engine.test.ts`
Expected: FAIL — `Cannot find module '../engine'`.

- [ ] **Step 3: 구현**

`src/lib/draft/engine.ts`:

```ts
import { buildSequence } from './sequence';
import type { Team, DraftState, SetResult, Step } from './types';

const TOTAL_STEPS = 16;

// 상태를 깊은-얕은 혼합 복사 (배열·레코드는 새로 생성해 불변성 유지).
function cloneState(s: DraftState): DraftState {
  return {
    map: s.map,
    firstPick: s.firstPick,
    cursor: s.cursor,
    bans: { blue: [...s.bans.blue], red: [...s.bans.red] },
    picks: { blue: [...s.picks.blue], red: [...s.picks.red] },
  };
}

// 빈 진행 상태로 세트 시작.
export function startSet(map: string, firstPick: Team): DraftState {
  return {
    map,
    firstPick,
    cursor: 0,
    bans: { blue: [], red: [] },
    picks: { blue: [], red: [] },
  };
}

export function isComplete(state: DraftState): boolean {
  return state.cursor >= TOTAL_STEPS;
}

// 현재 커서의 스텝. 완료 시 null.
export function currentStep(state: DraftState): Step | null {
  if (isComplete(state)) return null;
  return buildSequence(state.firstPick)[state.cursor];
}

// 밴 적용 (현재 스텝이 ban일 때만).
export function applyBan(state: DraftState, hero: string): DraftState {
  const step = currentStep(state);
  if (!step || step.kind !== 'ban') throw new Error('현재 스텝은 밴이 아니다');
  const next = cloneState(state);
  next.bans[step.team].push(hero);
  next.cursor += 1;
  return next;
}

// 픽 적용 (현재 스텝이 pick일 때만).
export function applyPick(state: DraftState, hero: string, playerId: string): DraftState {
  const step = currentStep(state);
  if (!step || step.kind !== 'pick') throw new Error('현재 스텝은 픽이 아니다');
  const next = cloneState(state);
  next.picks[step.team].push([playerId, hero]);
  next.cursor += 1;
  return next;
}

// 마지막 액션 되돌리기. cursor 0이면 무변화.
export function undo(state: DraftState): DraftState {
  if (state.cursor === 0) return state;
  const prev = buildSequence(state.firstPick)[state.cursor - 1];
  const next = cloneState(state);
  if (prev.kind === 'ban') next.bans[prev.team].pop();
  else next.picks[prev.team].pop();
  next.cursor -= 1;
  return next;
}

// 완료된 세트를 결과로 확정. 미완료면 예외.
export function finishSet(state: DraftState, winner: Team): SetResult {
  if (!isComplete(state)) throw new Error('드래프트가 완료되지 않았다');
  return {
    map: state.map,
    firstPick: state.firstPick,
    winner,
    bans: { blue: [...state.bans.blue], red: [...state.bans.red] },
    picks: { blue: [...state.picks.blue], red: [...state.picks.red] },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/draft/__tests__/engine.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/draft/engine.ts src/lib/draft/__tests__/engine.test.ts
git commit -m "feat: 드래프트 엔진 상태 전이(startSet/apply/undo/finishSet)"
```

---

### Task 6: 엔진 — `availableHeroes` 피어리스 필터

**Files:**
- Modify: `src/lib/draft/engine.ts` (함수 추가)
- Test: `src/lib/draft/__tests__/engine.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `CANONICAL_HEROES` (`@/lib/hero-image`), `Series, DraftState` (types.ts), `currentStep` (engine.ts).
- Produces: `availableHeroes(series: Series, state: DraftState, forPlayerId?: string): string[]`.

- [ ] **Step 1: 실패 테스트 추가**

`src/lib/draft/__tests__/engine.test.ts` 파일 상단 import에 `availableHeroes` 추가:

```ts
import {
  startSet, currentStep, isComplete, applyBan, applyPick, undo, finishSet, availableHeroes,
} from '../engine';
import type { DraftState, Series, SetResult } from '../types';
import { CANONICAL_HEROES } from '../../hero-image';
```

파일 하단에 describe 추가:

```ts
// 테스트용 시리즈 팩토리. 캐노니컬 영웅 3종을 상수로 사용.
const H0 = CANONICAL_HEROES[0];
const H1 = CANONICAL_HEROES[1];
const H2 = CANONICAL_HEROES[2];

function makeSeries(over: Partial<Series>): Series {
  return {
    draftType: 'normal',
    bestOf: 3,
    blue: [], red: [], sets: [], current: null,
    ...over,
  };
}

function priorSet(picks: SetResult['picks']): SetResult {
  return { map: '용의 둥지', firstPick: 'blue', winner: 'blue', bans: { blue: [], red: [] }, picks };
}

describe('availableHeroes', () => {
  it('이번 세트 밴/픽된 영웅은 전 종류에서 제외', () => {
    const series = makeSeries({ draftType: 'normal' });
    let state = startSet('하늘 사원', 'blue');
    state = applyBan(state, H0);                 // 밴됨
    const list = availableHeroes(series, state);
    expect(list).not.toContain(H0);
    expect(list).toContain(H1);
  });

  it('일반: 이전 세트 픽은 다시 고를 수 있다', () => {
    const series = makeSeries({
      draftType: 'normal',
      sets: [priorSet({ blue: [['p1', H0]], red: [] })],
    });
    const state = startSet('하늘 사원', 'blue');
    expect(availableHeroes(series, state)).toContain(H0);
  });

  it('하드: 이전 세트 누구든 픽한 영웅은 전역 제외', () => {
    const series = makeSeries({
      draftType: 'hard',
      sets: [priorSet({ blue: [['p1', H0]], red: [['p2', H1]] })],
    });
    const state = startSet('하늘 사원', 'blue');
    const list = availableHeroes(series, state);
    expect(list).not.toContain(H0);
    expect(list).not.toContain(H1);
    expect(list).toContain(H2);
  });

  it('소프트: 그 플레이어가 이전 세트에 픽한 영웅만 제외', () => {
    const series = makeSeries({
      draftType: 'soft',
      sets: [priorSet({ blue: [['p1', H0]], red: [['p2', H1]] })],
    });
    // 첫 픽 스텝까지 밴 4개 소비
    let state = startSet('하늘 사원', 'blue');
    state = applyBan(state, 'x1'); state = applyBan(state, 'x2');
    state = applyBan(state, 'x3'); state = applyBan(state, 'x4');
    // p1이 픽하는 경우: H0 잠김, H1(다른 사람 것)은 가능
    const forP1 = availableHeroes(series, state, 'p1');
    expect(forP1).not.toContain(H0);
    expect(forP1).toContain(H1);
    // p2가 픽하는 경우: H1 잠김, H0 가능
    const forP2 = availableHeroes(series, state, 'p2');
    expect(forP2).not.toContain(H1);
    expect(forP2).toContain(H0);
  });

  it('소프트: 밴 스텝(forPlayerId 없음)은 이전 픽 제약 없음', () => {
    const series = makeSeries({
      draftType: 'soft',
      sets: [priorSet({ blue: [['p1', H0]], red: [] })],
    });
    const state = startSet('하늘 사원', 'blue'); // 첫 스텝은 밴
    expect(availableHeroes(series, state)).toContain(H0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/draft/__tests__/engine.test.ts`
Expected: FAIL — `availableHeroes` is not exported.

- [ ] **Step 3: 구현**

`src/lib/draft/engine.ts` 상단 import에 추가:

```ts
import { CANONICAL_HEROES } from '@/lib/hero-image';
import type { Team, DraftState, SetResult, Step, Series } from './types';
```

(기존 `import type { Team, DraftState, SetResult, Step } from './types';` 줄을 위 줄로 교체 — `Series` 추가.)

파일 하단에 함수 추가:

```ts
// 이번 세트에서 이미 소비된(밴+픽) 영웅 집합.
function usedThisSet(state: DraftState): Set<string> {
  const used = new Set<string>();
  for (const h of state.bans.blue) used.add(h);
  for (const h of state.bans.red) used.add(h);
  for (const [, h] of state.picks.blue) used.add(h);
  for (const [, h] of state.picks.red) used.add(h);
  return used;
}

// 이전 세트들에서 특정 플레이어가 픽한 영웅 집합 (소프트 피어리스용).
function heroesPlayedBy(sets: SetResult[], playerId: string): Set<string> {
  const played = new Set<string>();
  for (const set of sets) {
    for (const team of ['blue', 'red'] as Team[]) {
      for (const [pid, hero] of set.picks[team]) {
        if (pid === playerId) played.add(hero);
      }
    }
  }
  return played;
}

// 이전 세트들에서 누구든 픽한 영웅 집합 (하드 피어리스용).
function heroesPickedInSeries(sets: SetResult[]): Set<string> {
  const picked = new Set<string>();
  for (const set of sets) {
    for (const team of ['blue', 'red'] as Team[]) {
      for (const [, hero] of set.picks[team]) picked.add(hero);
    }
  }
  return picked;
}

// 현재 스텝에서 선택 가능한 영웅 목록.
// forPlayerId: 소프트 피어리스에서 픽 스텝의 배정 플레이어. 밴 스텝이면 무시.
export function availableHeroes(series: Series, state: DraftState, forPlayerId?: string): string[] {
  const step = currentStep(state);
  const excluded = usedThisSet(state);

  if (series.draftType === 'hard') {
    for (const h of heroesPickedInSeries(series.sets)) excluded.add(h);
  }
  if (series.draftType === 'soft' && step?.kind === 'pick' && forPlayerId) {
    for (const h of heroesPlayedBy(series.sets, forPlayerId)) excluded.add(h);
  }

  return CANONICAL_HEROES.filter((h) => !excluded.has(h));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/draft/__tests__/engine.test.ts`
Expected: PASS (기존 11 + 신규 5 = 16 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/draft/engine.ts src/lib/draft/__tests__/engine.test.ts
git commit -m "feat: availableHeroes 피어리스 필터(일반/소프트/하드)"
```

---

### Task 7: localStorage 저장

**Files:**
- Create: `src/lib/draft/storage.ts`
- Test: `src/lib/draft/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `Series` (types.ts).
- Produces:
  - `loadSeries(): Series | null`
  - `saveSeries(series: Series): void`
  - `clearSeries(): void`
  - `STORAGE_KEY: string`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/draft/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSeries, saveSeries, clearSeries, STORAGE_KEY } from '../storage';
import type { Series } from '../types';

const sample: Series = {
  draftType: 'soft',
  bestOf: 5,
  blue: [{ id: 'a', name: '가나' }],
  red: [{ id: 'b', name: '다라' }],
  sets: [],
  current: null,
};

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('저장 후 로드하면 동일 데이터', () => {
    saveSeries(sample);
    expect(loadSeries()).toEqual(sample);
  });

  it('데이터 없으면 null', () => {
    expect(loadSeries()).toBeNull();
  });

  it('깨진 JSON이면 null(폴백)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid');
    expect(loadSeries()).toBeNull();
  });

  it('clearSeries는 키를 제거', () => {
    saveSeries(sample);
    clearSeries();
    expect(loadSeries()).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/draft/__tests__/storage.test.ts`
Expected: FAIL — `Cannot find module '../storage'` (또는 jsdom 환경 필요 에러).

만약 `localStorage is not defined` 에러가 나면 테스트 파일 최상단에 아래 주석을 추가한다(Vitest jsdom 환경 지정):

```ts
// @vitest-environment jsdom
```

- [ ] **Step 3: 구현**

`src/lib/draft/storage.ts`:

```ts
import type { Series } from './types';

export const STORAGE_KEY = 'cheesestorm.mockdraft.v1';

// 시리즈 로드. 없거나 파싱 실패 시 null(조용히 폴백).
export function loadSeries(): Series | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Series;
  } catch {
    return null;
  }
}

// 시리즈 저장 (Date 필드 없음 → 순수 JSON).
export function saveSeries(series: Series): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
}

// 시리즈 초기화.
export function clearSeries(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/draft/__tests__/storage.test.ts`
Expected: PASS (4 tests). jsdom 관련 에러 시 Step 2의 `@vitest-environment jsdom` 주석 적용 후 재실행.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/draft/storage.ts src/lib/draft/__tests__/storage.test.ts
git commit -m "feat: 모의 밴픽 localStorage 저장(load/save/clear)"
```

---

### Task 8: 페이지 셸 + 시리즈 셋업 UI

**Files:**
- Create: `src/app/mock-draft/page.tsx`
- Create: `src/components/mock-draft/series-setup.tsx`

**Interfaces:**
- Consumes: `getStreamers` (`@/lib/firestore`), `Series, Player, DraftType` (types.ts), `startSet` 은 다음 태스크에서 사용.
- Produces: `SeriesSetup` 컴포넌트 — `onStart(series: Series) => void` 콜백으로 구성 완료된 시리즈 전달. 페이지는 `series` 상태를 소유하고 localStorage에 저장.

이 태스크는 셋업 화면까지만 동작하게 한다(드래프트 보드는 Task 9). 셋업 완료 시 `series.current`는 null이며 "세트 시작" 화면(맵/선픽 선택)은 자리표시 텍스트로 둔다.

- [ ] **Step 1: 시리즈 셋업 컴포넌트 구현**

`src/components/mock-draft/series-setup.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getStreamers } from '@/lib/firestore';
import type { Streamer } from '@/lib/types';
import type { Series, Player, DraftType } from '@/lib/draft/types';

const DRAFT_LABELS: Record<DraftType, string> = {
  normal: '일반',
  soft: '소프트 피어리스',
  hard: '하드 피어리스',
};

// 스트리머 → Player 변환.
function toPlayer(s: Streamer): Player {
  return { id: s.id, name: s.name, imageUrl: s.profileImageUrl };
}

interface Props {
  onStart: (series: Series) => void;
}

export function SeriesSetup({ onStart }: Props) {
  const [draftType, setDraftType] = useState<DraftType>('normal');
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [blue, setBlue] = useState<Player[]>([]);
  const [red, setRed] = useState<Player[]>([]);
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    getStreamers().then(setStreamers).catch(() => setStreamers([]));
  }, []);

  const inRoster = (id: string) =>
    blue.some((p) => p.id === id) || red.some((p) => p.id === id);

  // 팀에 플레이어 추가(5명 초과 방지, 중복 방지).
  function addTo(team: 'blue' | 'red', player: Player) {
    const list = team === 'blue' ? blue : red;
    const setList = team === 'blue' ? setBlue : setRed;
    if (list.length >= 5 || inRoster(player.id)) return;
    setList([...list, player]);
  }

  function removeFrom(team: 'blue' | 'red', id: string) {
    const setList = team === 'blue' ? setBlue : setRed;
    const list = team === 'blue' ? blue : red;
    setList(list.filter((p) => p.id !== id));
  }

  function addManual(team: 'blue' | 'red') {
    const name = manualName.trim();
    if (!name) return;
    addTo(team, { id: `manual:${crypto.randomUUID()}`, name });
    setManualName('');
  }

  const canStart = blue.length === 5 && red.length === 5;

  function handleStart() {
    if (!canStart) return;
    onStart({ draftType, bestOf, blue, red, sets: [], current: null });
  }

  const available = streamers.filter((s) => !inRoster(s.id));

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>모의 밴픽 — 시리즈 설정</h1>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>드래프트 종류:{' '}
          <select value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)}>
            {(Object.keys(DRAFT_LABELS) as DraftType[]).map((k) => (
              <option key={k} value={k}>{DRAFT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label>방식:{' '}
          <select value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as 3 | 5)}>
            <option value={3}>Bo3</option>
            <option value={5}>Bo5</option>
          </select>
        </label>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['blue', 'red'] as const).map((team) => {
          const list = team === 'blue' ? blue : red;
          return (
            <div key={team} style={{ border: '1px solid #8884', borderRadius: 8, padding: 8 }}>
              <strong style={{ color: team === 'blue' ? '#3b82f6' : '#ef4444' }}>
                {team === 'blue' ? '블루 팀' : '레드 팀'} ({list.length}/5)
              </strong>
              <ul style={{ margin: '8px 0', display: 'grid', gap: 4 }}>
                {list.map((p) => (
                  <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.name}</span>
                    <button onClick={() => removeFrom(team, p.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section>
        <strong>스트리머 목록에서 추가</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {available.map((s) => (
            <span key={s.id} style={{ display: 'inline-flex', gap: 4, border: '1px solid #8884', borderRadius: 6, padding: '2px 6px' }}>
              {s.name}
              <button onClick={() => addTo('blue', toPlayer(s))} style={{ color: '#3b82f6' }}>블루</button>
              <button onClick={() => addTo('red', toPlayer(s))} style={{ color: '#ef4444' }}>레드</button>
            </span>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="수동 이름 입력"
        />
        <button onClick={() => addManual('blue')} style={{ color: '#3b82f6' }}>블루 추가</button>
        <button onClick={() => addManual('red')} style={{ color: '#ef4444' }}>레드 추가</button>
      </section>

      <button
        onClick={handleStart}
        disabled={!canStart}
        style={{ padding: '8px 16px', fontWeight: 700, opacity: canStart ? 1 : 0.5 }}
      >
        {canStart ? '시리즈 시작' : '양 팀 5명씩 채워주세요'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 페이지 셸 구현**

`src/app/mock-draft/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import type { Series } from '@/lib/draft/types';

export default function MockDraftPage() {
  const [series, setSeries] = useState<Series | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 진입 시 localStorage 복원.
  useEffect(() => {
    setSeries(loadSeries());
    setLoaded(true);
  }, []);

  // 변경마다 저장.
  useEffect(() => {
    if (!loaded) return;
    if (series) saveSeries(series);
  }, [series, loaded]);

  function reset() {
    clearSeries();
    setSeries(null);
  }

  if (!loaded) return null;

  if (!series) {
    return (
      <main style={{ padding: 16 }}>
        <SeriesSetup onStart={setSeries} />
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>모의 밴픽 진행 중</h1>
        <button onClick={reset}>시리즈 초기화</button>
      </div>
      {/* Task 9~10에서 세트 셋업/드래프트 보드/스코어보드로 대체 */}
      <p style={{ marginTop: 12 }}>
        종류: {series.draftType} · {`Bo${series.bestOf}`} · 블루 {series.blue.length}명 / 레드 {series.red.length}명
      </p>
    </main>
  );
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공. `/mock-draft` 라우트가 출력에 포함.

- [ ] **Step 4: 수동 확인**

Run: `npm run dev` 후 브라우저에서 `http://localhost:3000/mock-draft` 접속.
확인:
- 드래프트 종류·Bo 선택 드롭다운 표시.
- 스트리머 목록에서 블루/레드 각 5명 추가 시 "시리즈 시작" 버튼 활성화.
- 시작 후 새로고침해도 진행 상태 유지(localStorage), "시리즈 초기화"로 리셋.

- [ ] **Step 5: 커밋**

```bash
git add src/app/mock-draft/page.tsx src/components/mock-draft/series-setup.tsx
git commit -m "feat: 모의 밴픽 페이지 셸 + 시리즈 셋업 UI"
```

---

### Task 9: 세트 셋업 + 드래프트 보드 + 영웅 그리드

**Files:**
- Create: `src/components/mock-draft/hero-grid.tsx`
- Create: `src/components/mock-draft/draft-board.tsx`
- Modify: `src/app/mock-draft/page.tsx` (세트 셋업/보드 연결)

**Interfaces:**
- Consumes: 엔진 전부(`startSet, currentStep, isComplete, applyBan, applyPick, undo, finishSet, availableHeroes`), `availableMaps` (maps.ts), `CANONICAL_HEROES`·`heroImageUrl` (hero-image.ts), `roleOfHero` (heroes.ts), `Series, DraftState, Team, Player` (types.ts).
- Produces:
  - `HeroGrid` — `{ available: string[]; onPick: (hero: string) => void }`.
  - `DraftBoard` — `{ series: Series; state: DraftState; onApply: (next: DraftState) => void; onUndo: () => void; onFinish: (winner: Team) => void }`.

- [ ] **Step 1: 영웅 그리드 구현**

`src/components/mock-draft/hero-grid.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CANONICAL_HEROES, heroImageUrl } from '@/lib/hero-image';
import { roleOfHero } from '@/lib/heroes';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

interface Props {
  available: string[];              // 선택 가능한 영웅(잠긴 영웅 제외됨)
  onPick: (hero: string) => void;
}

export function HeroGrid({ available, onPick }: Props) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const availableSet = new Set(available);

  const shown = CANONICAL_HEROES.filter((h) => {
    if (role !== 'all' && roleOfHero(h) !== role) return false;
    if (q && !h.includes(q.trim())) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setRole('all')} style={{ fontWeight: role === 'all' ? 700 : 400 }}>전체</button>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ fontWeight: role === r ? 700 : 400 }}>{r}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="영웅 검색" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
        {shown.map((h) => {
          const enabled = availableSet.has(h);
          const img = heroImageUrl(h);
          return (
            <button
              key={h}
              disabled={!enabled}
              onClick={() => enabled && onPick(h)}
              title={h}
              style={{ opacity: enabled ? 1 : 0.3, display: 'grid', justifyItems: 'center', gap: 2, padding: 2 }}
            >
              {img && <Image src={img} alt={h} width={48} height={48} style={{ borderRadius: 6 }} />}
              <span style={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center' }}>{h}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 드래프트 보드 구현**

`src/components/mock-draft/draft-board.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { HeroGrid } from './hero-grid';
import {
  currentStep, isComplete, applyBan, applyPick, availableHeroes,
} from '@/lib/draft/engine';
import type { Series, DraftState, Team, Player } from '@/lib/draft/types';

interface Props {
  series: Series;
  state: DraftState;
  onApply: (next: DraftState) => void;
  onUndo: () => void;
  onFinish: (winner: Team) => void;
}

// 팀의 이미 픽에 배정된 플레이어 id 집합.
function assignedIds(state: DraftState, team: Team): Set<string> {
  return new Set(state.picks[team].map(([pid]) => pid));
}

export function DraftBoard({ series, state, onApply, onUndo, onFinish }: Props) {
  const step = currentStep(state);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  const done = isComplete(state);

  // 현재 픽 스텝 팀의 미배정 플레이어 목록.
  const pickTeamPlayers: Player[] = step?.kind === 'pick'
    ? (step.team === 'blue' ? series.blue : series.red).filter(
        (p) => !assignedIds(state, step.team).has(p.id),
      )
    : [];

  // 현재 스텝의 선택 가능 영웅. 픽 스텝이면 선택된 플레이어 기준(소프트 피어리스).
  const available = step
    ? availableHeroes(series, state, step.kind === 'pick' ? selectedPlayer || undefined : undefined)
    : [];

  function handlePick(hero: string) {
    if (!step) return;
    if (step.kind === 'ban') {
      onApply(applyBan(state, hero));
    } else {
      if (!selectedPlayer) return;           // 플레이어 미선택 시 무시
      onApply(applyPick(state, hero, selectedPlayer));
      setSelectedPlayer('');
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px', gap: 12 }}>
      <TeamColumn team="blue" series={series} state={state} />

      <div style={{ display: 'grid', gap: 8 }}>
        {!done && step && (
          <div style={{ textAlign: 'center', fontWeight: 700 }}>
            <span style={{ color: step.team === 'blue' ? '#3b82f6' : '#ef4444' }}>
              {step.team === 'blue' ? '블루' : '레드'}
            </span>{' '}
            {step.kind === 'ban' ? '밴' : '픽'} 차례
          </div>
        )}

        {!done && step?.kind === 'pick' && (
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
            <option value="">플레이어 선택</option>
            {pickTeamPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {!done && <HeroGrid available={available} onPick={handlePick} />}

        {done && (
          <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
            <strong>드래프트 완료 — 승자 선택</strong>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => onFinish('blue')} style={{ color: '#3b82f6' }}>블루 승</button>
              <button onClick={() => onFinish('red')} style={{ color: '#ef4444' }}>레드 승</button>
            </div>
          </div>
        )}

        <button onClick={onUndo} disabled={state.cursor === 0} style={{ justifySelf: 'center' }}>되돌리기</button>
      </div>

      <TeamColumn team="red" series={series} state={state} />
    </div>
  );
}

// 팀 픽/밴 슬롯 표시.
function TeamColumn({ team, series, state }: { team: Team; series: Series; state: DraftState }) {
  const players = team === 'blue' ? series.blue : series.red;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  return (
    <div style={{ border: '1px solid #8884', borderRadius: 8, padding: 8, display: 'grid', gap: 6 }}>
      <strong style={{ color: team === 'blue' ? '#3b82f6' : '#ef4444' }}>
        {team === 'blue' ? '블루' : '레드'}
      </strong>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>픽</div>
        {state.picks[team].map(([pid, hero], i) => (
          <div key={i} style={{ fontSize: 13 }}>{nameOf(pid)} — {hero}</div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>밴</div>
        <div style={{ fontSize: 13 }}>{state.bans[team].join(', ')}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 페이지에 세트 셋업 + 보드 연결**

`src/app/mock-draft/page.tsx`를 아래로 교체:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { SeriesSetup } from '@/components/mock-draft/series-setup';
import { DraftBoard } from '@/components/mock-draft/draft-board';
import { loadSeries, saveSeries, clearSeries } from '@/lib/draft/storage';
import { startSet, finishSet, undo as undoState } from '@/lib/draft/engine';
import { availableMaps } from '@/lib/draft/maps';
import type { Series, DraftState, Team } from '@/lib/draft/types';

export default function MockDraftPage() {
  const [series, setSeries] = useState<Series | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState('');
  const [firstPick, setFirstPick] = useState<Team>('blue');

  useEffect(() => {
    setSeries(loadSeries());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (series) saveSeries(series);
  }, [series, loaded]);

  if (!loaded) return null;

  function reset() {
    clearSeries();
    setSeries(null);
    setMap('');
  }

  if (!series) {
    return <main style={{ padding: 16 }}><SeriesSetup onStart={setSeries} /></main>;
  }

  const usedMaps = series.sets.map((s) => s.map);
  const maps = availableMaps(usedMaps);

  function startCurrentSet() {
    if (!series || !map) return;
    setSeries({ ...series, current: startSet(map, firstPick) });
  }

  function applyNext(next: DraftState) {
    if (!series) return;
    setSeries({ ...series, current: next });
  }

  function undoCurrent() {
    if (!series?.current) return;
    setSeries({ ...series, current: undoState(series.current) });
  }

  function finishCurrent(winner: Team) {
    if (!series?.current) return;
    const result = finishSet(series.current, winner);
    setSeries({ ...series, sets: [...series.sets, result], current: null });
    setMap('');
  }

  return (
    <main style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          모의 밴픽 · {series.draftType} · {`Bo${series.bestOf}`}
        </h1>
        <button onClick={reset}>시리즈 초기화</button>
      </div>

      {!series.current ? (
        <section style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          <strong>세트 {series.sets.length + 1} 설정</strong>
          <label>맵:{' '}
            <select value={map} onChange={(e) => setMap(e.target.value)}>
              <option value="">맵 선택</option>
              {maps.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>선픽:{' '}
            <select value={firstPick} onChange={(e) => setFirstPick(e.target.value as Team)}>
              <option value="blue">블루</option>
              <option value="red">레드</option>
            </select>
          </label>
          <button onClick={startCurrentSet} disabled={!map}>세트 시작</button>
        </section>
      ) : (
        <DraftBoard
          series={series}
          state={series.current}
          onApply={applyNext}
          onUndo={undoCurrent}
          onFinish={finishCurrent}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 5: 수동 확인**

Run: `npm run dev` → `/mock-draft`에서 시리즈 시작 후:
- 세트 설정에서 맵/선픽 선택 → "세트 시작".
- 현재 스텝 배너가 밴↔픽·블루↔레드로 순서대로 진행.
- 픽 스텝에서 플레이어 선택 후 영웅 클릭 시 해당 플레이어에 배정.
- 잠긴 영웅(이번 세트 이미 사용)은 흐리게·클릭 불가.
- 16스텝 완료 후 승자 선택 → 세트 저장, 다음 세트 설정으로 복귀.
- 2세트에서 이전 맵이 목록에서 사라짐(중복 금지).
- (하드/소프트 시리즈로) 2세트 픽에서 피어리스 잠금 반영 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/mock-draft/hero-grid.tsx src/components/mock-draft/draft-board.tsx src/app/mock-draft/page.tsx
git commit -m "feat: 세트 셋업 + 드래프트 보드 + 영웅 그리드"
```

---

### Task 10: 스코어보드 + 플레이어별 픽 이력

**Files:**
- Create: `src/components/mock-draft/scoreboard.tsx`
- Create: `src/components/mock-draft/pick-history.tsx`
- Modify: `src/app/mock-draft/page.tsx` (두 패널 배치)

**Interfaces:**
- Consumes: `Series` (types.ts).
- Produces:
  - `Scoreboard` — `{ series: Series }`. 세트 스코어와 클린치 표시.
  - `PickHistory` — `{ series: Series }`. 플레이어별 세트 이력.

- [ ] **Step 1: 스코어보드 구현**

`src/components/mock-draft/scoreboard.tsx`:

```tsx
'use client';

import type { Series } from '@/lib/draft/types';

export function Scoreboard({ series }: Props) {
  const blueWins = series.sets.filter((s) => s.winner === 'blue').length;
  const redWins = series.sets.filter((s) => s.winner === 'red').length;
  const needed = series.bestOf === 3 ? 2 : 3;
  const clinched = blueWins >= needed ? 'blue' : redWins >= needed ? 'red' : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', fontWeight: 700 }}>
      <span style={{ color: '#3b82f6' }}>블루 {blueWins}</span>
      <span>-</span>
      <span style={{ color: '#ef4444' }}>{redWins} 레드</span>
      {clinched && (
        <span style={{ marginLeft: 8, fontSize: 13 }}>
          🏆 {clinched === 'blue' ? '블루' : '레드'} 시리즈 승리
        </span>
      )}
    </div>
  );
}

interface Props {
  series: Series;
}
```

- [ ] **Step 2: 플레이어별 픽 이력 구현**

`src/components/mock-draft/pick-history.tsx`:

```tsx
'use client';

import type { Series, Player } from '@/lib/draft/types';

// 플레이어별 세트 순서대로 픽한 영웅 목록.
function historyFor(series: Series, playerId: string): string[] {
  const heroes: string[] = [];
  for (const set of series.sets) {
    for (const team of ['blue', 'red'] as const) {
      for (const [pid, hero] of set.picks[team]) {
        if (pid === playerId) heroes.push(hero);
      }
    }
  }
  return heroes;
}

function TeamHistory({ title, players, series }: { title: string; players: Player[]; series: Series }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      {players.map((p) => (
        <div key={p.id} style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>{p.name}</span>: {historyFor(series, p.id).join(', ') || '—'}
        </div>
      ))}
    </div>
  );
}

export function PickHistory({ series }: { series: Series }) {
  if (series.sets.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '1px solid #8884', borderRadius: 8, padding: 8 }}>
      <TeamHistory title="블루 픽 이력" players={series.blue} series={series} />
      <TeamHistory title="레드 픽 이력" players={series.red} series={series} />
    </div>
  );
}
```

- [ ] **Step 3: 페이지에 패널 배치**

`src/app/mock-draft/page.tsx` 상단 import에 추가:

```tsx
import { Scoreboard } from '@/components/mock-draft/scoreboard';
import { PickHistory } from '@/components/mock-draft/pick-history';
```

`<main>` 내부, 헤더(`<h1>`이 든 div) 바로 아래에 스코어보드를, 그리고 `</main>` 직전에 픽 이력을 배치:

```tsx
      {/* 헤더 div 바로 다음 줄에 추가 */}
      <Scoreboard series={series} />

      {/* ...기존 세트 설정 / DraftBoard 분기... */}

      {/* </main> 직전에 추가 */}
      <PickHistory series={series} />
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 5: 수동 확인**

Run: `npm run dev` → `/mock-draft`:
- 세트 1 완료 후 스코어보드가 `블루 1 - 0 레드`처럼 갱신.
- 픽 이력 패널에 각 플레이어의 세트별 픽이 누적 표시.
- Bo3에서 한 팀 2승 시 🏆 클린치 표시(진행은 계속 가능).

- [ ] **Step 6: 커밋**

```bash
git add src/components/mock-draft/scoreboard.tsx src/components/mock-draft/pick-history.tsx src/app/mock-draft/page.tsx
git commit -m "feat: 스코어보드 + 플레이어별 픽 이력 패널"
```

---

### Task 11: 네비게이션 진입점

**Files:**
- Modify: `src/components/site-header.tsx:45-48` (`NAV_ITEMS`)
- Modify: `src/components/bottom-tab-bar.tsx:8-11` (`TAB_ITEMS`)

**Interfaces:**
- Consumes: 없음(정적 배열 항목 추가).
- Produces: 없음.

- [ ] **Step 1: 헤더 네비 항목 추가**

`src/components/site-header.tsx`의 `NAV_ITEMS` 배열(45~48줄)에 항목 추가:

```tsx
  { href: '/',         ko: '티어리스트',   en: 'Tier List'    },
  { href: '/matches',  ko: '내전기록실',   en: 'Match Room'   },
  { href: '/streamers',ko: '스트리머',     en: 'Roster'       },
  { href: '/mock-draft', ko: '모의밴픽',   en: 'Mock Draft'   },
  { href: '/guide',    ko: '사용방법',     en: 'How To Use'   },
```

- [ ] **Step 2: 하단 탭 항목 추가**

`src/components/bottom-tab-bar.tsx`의 `TAB_ITEMS` 배열(8~11줄)에 항목 추가:

```tsx
  { href: '/',          label: '티어리스트', icon: '★' },
  { href: '/matches',   label: '내전기록실', icon: '⚔' },
  { href: '/mock-draft', label: '모의밴픽',  icon: '⚑' },
  { href: '/streamers', label: '스트리머',   icon: '◈' },
  { href: '/guide',     label: '사용방법',   icon: '?' },
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 4: 수동 확인**

Run: `npm run dev` → 상단 헤더·모바일 하단 탭에 "모의밴픽" 링크 표시, 클릭 시 `/mock-draft` 이동, 활성 상태 하이라이트 동작.

- [ ] **Step 5: 커밋**

```bash
git add src/components/site-header.tsx src/components/bottom-tab-bar.tsx
git commit -m "feat: 네비게이션에 모의밴픽 링크 추가"
```

---

### Task 12: 전체 회귀 확인

**Files:** 없음(검증만).

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 신규 draft 테스트(maps 3 + hero-image 3 + sequence 5 + engine 16 + storage 4) 및 기존 테스트 전부 PASS.

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 에러 없음(경고는 기존 수준 유지).

- [ ] **Step 3: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, `/mock-draft` 라우트 포함.

- [ ] **Step 4: 최종 수동 시나리오 (Bo3 소프트 피어리스)**

`npm run dev`로 아래를 한 번에 통과:
1. 소프트 피어리스 · Bo3 선택, 양 팀 5명 구성, 시작.
2. 세트1: 맵 A·선픽 블루, 16스텝 드래프트 완료(픽마다 플레이어 지정), 블루 승 지정.
3. 세트2: 맵 목록에 A 없음 확인. 세트1에 특정 플레이어가 픽한 영웅이 그 플레이어 픽 스텝에서만 잠김 확인. 레드 승.
4. 스코어 `1 - 1`, 픽 이력 누적 표시 확인.
5. 새로고침 → 상태 복원. "시리즈 초기화" → 셋업 화면 복귀.

- [ ] **Step 5: 커밋(문서/정리 있을 시)**

변경 없으면 생략. 있으면:

```bash
git add -A
git commit -m "chore: 모의 밴픽 회귀 확인 정리"
```

---

## Self-Review

**Spec coverage:**
- 시리즈 연속 진행 → Task 3(Series.sets/current), 9~10(세트 루프). ✅
- localStorage 저장 → Task 7, 8. ✅
- 로스터 DB+수동 → Task 8(SeriesSetup). ✅
- 픽↔플레이어 바인딩 → Task 3(Pick), 9(플레이어 선택). ✅
- 선픽 수동 지정 → Task 9(firstPick select). ✅
- 드래프트 3종 + 피어리스 → Task 6(availableHeroes). ✅
- 맵 중복 금지 → Task 1(availableMaps), 9(세트 셋업). ✅
- 승자/스코어/클린치 → Task 5(finishSet), 10(Scoreboard). ✅
- 플레이어별 세트 이력 → Task 10(PickHistory). ✅
- HotS 16스텝 순서 → Task 4(buildSequence). ✅
- 캐노니컬 영웅 그리드 → Task 2, 9(HeroGrid). ✅
- 네비 진입점 → Task 11. ✅
- 테스트 → 각 lib 태스크 + Task 12. ✅

**Placeholder scan:** Task 8은 의도적으로 자리표시 UI를 두되 Task 9에서 완전 교체(단계 명시). 그 외 "TBD/TODO/적절히" 없음. ✅

**Type consistency:** `Series/DraftState/SetResult/Player/Pick/Team/Step`은 Task 3 정의를 전 태스크가 그대로 사용. 엔진 시그니처(`startSet(map, firstPick)`, `applyPick(state, hero, playerId)`, `availableHeroes(series, state, forPlayerId?)`, `finishSet(state, winner)`)가 Task 5/6 정의와 Task 9 호출부 일치. `CANONICAL_HEROES`(Task 2)·`availableMaps`(Task 1) 시그니처 일치. ✅

**Note:** Task 5 테스트 파일을 Task 6에서 확장하며 import 라인을 교체(중복 선언 방지 위해 Task 6 Step 1이 import 블록 전체를 다시 명시). 실행 시 import 병합에 유의.
