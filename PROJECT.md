# Cheesestorm — 프로젝트 기록서

> 이 문서는 프로젝트의 구조·기술·결정 근거를 기록합니다.
> 기능을 추가하거나 설계를 변경할 때마다 해당 섹션과 [변경 이력](#변경-이력)을 함께 업데이트합니다.

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [배경 & 목적](#2-배경--목적)
3. [기술 스택](#3-기술-스택)
4. [디렉토리 구조](#4-디렉토리-구조)
5. [데이터 모델](#5-데이터-모델)
6. [페이지 구성](#6-페이지-구성)
7. [핵심 비즈니스 로직](#7-핵심-비즈니스-로직)
8. [디자인 시스템](#8-디자인-시스템)
9. [에이전트 스킬 구성](#9-에이전트-스킬-구성)
10. [환경 설정](#10-환경-설정)
11. [배포](#11-배포)
12. [변경 이력](#12-변경-이력)

---

## 1. 한눈에 보기

| 항목 | 내용 |
|------|------|
| **서비스명** | Cheesestorm |
| **목적** | 치지직 스트리머들의 HotS 내전 결과 기록 + 티어리스트 |
| **주요 사용자** | 내전 참가 스트리머, 시청자 |
| **운영 주기** | 연 2~3주 (행사 기간에만 활성) |
| **현재 상태** | MVP(#1~#7) 완료. 롤 파생 전환·스트리머 육각형 카드 적용. 2차 개선(#13~#25) 분해 완료, 착수 대기 |
| **스택 요약** | Next.js 15 · Firebase Firestore · Tailwind CSS v4 · Gemini API · Vercel |

---

## 2. 배경 & 목적

### 문제

치지직 스트리머들이 주최하는 히어로즈 오브 더 스톰 내전은 연 2~3주 단위로만 열린다.
경기 결과가 흩어져 있어 누가 얼마나 이겼는지, 전체적인 티어가 어떻게 되는지를 한눈에 보기 어렵다.

### 해결

- 경기 결과(팀 구성·맵·승패)를 입력할 수 있는 간단한 관리 화면
- 승률 기반으로 자동 계산되는 S~D 티어리스트

### 제약

- **연 2~3주만 활성**: 월 과금 서비스는 비용 낭비 → Firebase Spark 플랜(무료, 일시정지 없음) 선택
- MVP 우선: 인증 없이 URL을 아는 사람이 바로 입력 가능

---

## 3. 기술 스택

### 채택 기술

| 분류 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 프레임워크 | Next.js (App Router) | 15 | SSR + API Routes 일체형, Vercel 최적화 |
| 언어 | TypeScript | 5 | 타입 안정성 |
| 데이터베이스 | Firebase Firestore | Spark 무료 | 유휴 시 비용 0원, 일시정지 없음 |
| 스타일 | Tailwind CSS | v4 | 유틸리티 우선, 빠른 개발 |
| UI 컴포넌트 | shadcn/ui | 최신 | Tailwind 기반, 커스텀 용이 |
| 배포 | Vercel | — | Next.js 공식 플랫폼, git push 배포 |

### 검토했지만 채택하지 않은 기술

| 기술 | 제외 이유 |
|------|-----------|
| Supabase | 무료 티어 1주 비활성 시 자동 일시정지 → 행사 전 수동 복구 필요 |
| Cloudflare D1 | 충분히 좋지만 Firebase보다 설정 복잡도 높음 |
| Firebase Auth | MVP에서 불필요, 관리자 인증은 추후 추가 예정 |

---

## 4. 디렉토리 구조

```
cheesestorm/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # 전역 레이아웃 (SiteHeader 포함)
│   │   ├── page.tsx                      # / — 티어리스트
│   │   ├── api/
│   │   │   └── parse-screenshot/
│   │   │       └── route.ts              # POST /api/parse-screenshot (Gemini OCR)
│   │   ├── matches/
│   │   │   ├── page.tsx                  # /matches — 경기 결과 타임라인
│   │   │   └── new/
│   │   │       └── page.tsx              # /matches/new — 경기 입력 (슬롯 + OCR)
│   │   └── streamers/
│   │       ├── page.tsx                  # /streamers — 스트리머 관리 (육각형 벌집 카드)
│   │       └── [id]/
│   │           └── page.tsx              # /streamers/[id] — 개인 전적 프로필
│   ├── components/
│   │   ├── site-header.tsx               # 클라이언트 헤더 (네비 + ☾/☀ 토글)
│   │   ├── hexagon-avatar.tsx            # 공용 육각형 아바타(HexAvatar) + 티어색 토큰
│   │   └── ui/                           # shadcn/ui 컴포넌트
│   ├── lib/
│   │   ├── firebase.ts                   # Firebase 앱 초기화
│   │   ├── firestore.ts                  # Firestore CRUD 함수 모음
│   │   ├── tier.ts                       # 티어 계산 로직 + 그룹화 (롤은 deriveRole 위임)
│   │   ├── match.ts                      # 단일 경기 질의 (outcomeFor·heroOf·statOf 등)
│   │   ├── heroes.ts                     # 영웅→역할군 매핑, roleOfHero·roleAffinity·deriveRole
│   │   ├── profile.ts                    # getStreamerProfile·getRecentMatches·currentStreak·kdaFor
│   │   ├── streamer.ts                   # validateStreamerForm·parseChzzkId
│   │   ├── theme.ts                      # resolveTheme (dark/light)
│   │   ├── types.ts                      # 공통 TypeScript 타입
│   │   ├── utils.ts                      # shadcn 유틸 (cn 함수)
│   │   └── __tests__/                    # Vitest 단위 테스트 (52개)
│   ├── styles/tokens/                    # DS CSS 변수 파일
│   │   ├── colors.css                    # 브랜드·중립·티어·의미 색상
│   │   ├── typography.css                # 폰트 변수
│   │   ├── spacing.css                   # sp-0 ~ sp-20
│   │   ├── effects.css                   # 반경·그림자·글로우·모션
│   │   ├── base.css                      # 리셋 + cheese-static-bg
│   │   └── light.css                     # 라이트모드 [data-theme="light"] 오버라이드
│   └── test/fixtures/                    # 목 데이터 (streamers, matches, stats)
├── claudecode-design/                    # Claude Design 핸드오프 번들 (레퍼런스)
│   └── project/
│       ├── _ds/                          # 디자인 시스템 토큰 + 컴포넌트 번들
│       ├── dash-*.jsx                    # 하이파이 페이지 목업
│       └── wf-*.jsx                      # 와이어프레임 시안
├── docs/
│   ├── adr/
│   │   ├── 0001-mmr-deferred.md          # ADR: MMR 시스템 구현 유보
│   │   ├── 0002-team-labels-are-arbitrary.md   # ADR: blue/red 임의 레이블, 진영 선택 기록
│   │   ├── 0003-capture-perishable-stats.md    # ADR: 보존성 경기 스탯 수집
│   │   ├── 0004-auth-deferred.md         # ADR: 인증 유보, 쓰기 개방
│   │   ├── 0005-dual-streamer-tierlist.md      # ADR: 자동+큐레이션 티어 이원화
│   │   └── req.md                        # 2차 요구사항 메모 (→ #13~#25로 분해됨)
│   └── agents/                           # 에이전트 스킬 설정
├── CONTEXT.md                            # 도메인 용어 사전
├── CLAUDE.md                             # Claude Code 작업 지침
├── .env.local.example                    # 환경변수 템플릿
└── PROJECT.md                            # 이 문서
```

---

## 5. 데이터 모델

Firebase Firestore 컬렉션 구조.

### `streamers`

내전에 참가하는 스트리머 정보.

```typescript
{
  id: string;                                                    // Firestore 자동 생성 ID
  name: string;                                                  // 닉네임 (필수)
  chzzkId?: string;                                              // 치지직 채널 ID (선택)
  role?: '탱커' | '투사' | '암살자' | '지원가' | '전문가';        // 레거시 — 롤은 더 이상 저장 안 함(내전 기록에서 파생)
  accountLevel?: number;                                         // HotS 계정레벨
  gameNames?: string[];                                          // 인게임 이름(배틀태그) 목록 — OCR 매칭용
  profileImageUrl?: string;                                      // 치지직 프로필 사진(없으면 닉네임 이니셜 폴백)
  createdAt: Timestamp;
}
```

> **롤 파생 전환**: `role`은 입력받지 않고 내전 기록의 최다 플레이 영웅 역할군으로 파생(`deriveRole`). 필드는 레거시로 남되 신규 입력에 쓰지 않는다. (CONTEXT「롤」)
> **계획(미구현, #16·#12)**: `Match.leftTeam?`(인게임 좌측 진영, 선택) 및 `curatedTiers`(큐레이션 티어 배치, ADR-0005) 추가 예정.

### `matches`

경기 한 건의 결과.

```typescript
{
  id: string;                          // Firestore 자동 생성 ID
  date: Timestamp;                     // 경기 날짜
  blueTeam: [string, string][];        // [streamerId, heroName] 쌍 배열
  redTeam: [string, string][];         // [streamerId, heroName] 쌍 배열
  blueStats?: PlayerMatchStat[];       // 스크린샷 파싱 시 채워지는 개인 스탯
  redStats?: PlayerMatchStat[];        // blueTeam/redTeam 인덱스 대응
  winner: 'blue' | 'red';             // 승리 진영
  map?: string;                        // 맵 이름
  dur?: string;                        // 경기시간 (예: "21:04")
  note?: string;                       // 메모
  createdAt: Timestamp;
}

// 개인 스탯 (스크린샷 자동 파싱으로 채워짐 — 선택적)
interface PlayerMatchStat {
  kills: number; assists: number; deaths: number;
  siegeDmg: number; heroDmg: number;
  healing: number; selfHeal: number; xp: number;
}
```

> **주의**: `blueTeam`/`redTeam`이 초기 구현의 `string[]`에서 `[string, string][]`로 변경됨.
> Firestore에 기존 데이터가 있다면 마이그레이션 필요.

### 설계 결정

- **플레이어 통계를 별도 컬렉션으로 저장하지 않는 이유**: 경기 수가 적어(수십 건 수준) 클라이언트에서 전체 matches를 내려받아 실시간 계산해도 충분하다. 캐시나 집계 컬렉션은 데이터 정합성 관리 부담만 늘린다.
- **MMR 미구현**: 초기에는 승률만으로 충분. 향후 Elo 방식 추가 예정. `docs/adr/0001-mmr-deferred.md` 참조.
- **팀 레이블 임의값**: `blue`/`red`는 인게임 진영과 무관한 임의 버킷. 진영은 선택적 `leftTeam`으로만 기록. `docs/adr/0002` 참조.
- **보존성 스탯**: `blueStats`/`redStats`는 읽는 화면이 없어도 삭제 금지(스크린샷 소실 = 재취득 불가). `docs/adr/0003` 참조.
- **인증 유보**: Firestore 쓰기 개방(`if true`), 관리자 로그인 추후. `docs/adr/0004` 참조.
- **티어 이원화**: 스트리머 자동(승률)과 큐레이션(수동)을 분리, 영웅 티어는 자동만. `docs/adr/0005` 참조.

---

## 6. 페이지 구성

| 경로 | 제목 | 역할 | 인증 필요 |
|------|------|------|-----------|
| `/` | 티어리스트 | 전체 스트리머 S~D 티어 행, 포지션/이름 필터 | 없음 |
| `/matches` | 내전기록실 | 날짜별 타임라인, 클릭 시 양 팀 라인업 확장 | 없음 |
| `/matches/new` | 경기 입력 | 5인 슬롯 팀 구성, 스크린샷 드래그&드롭 → Gemini OCR 자동 채움 | 없음 (MVP) |
| `/streamers` | 스트리머 관리 | 추가(이름·채널ID·포지션)·삭제, 포지션 토글 칩 | 없음 (MVP) |
| `/streamers/[id]` | 개인 전적 | 310px sticky 사이드바(티어·승률바·스탯필) + 영웅 승률 그리드 + 최근 6경기 | 없음 |

---

## 7. 핵심 비즈니스 로직

### 티어 계산 (`src/lib/tier.ts`)

**알고리즘**: 단순 승률 기반. 경기 수가 적은 리그에서 ELO/TrueSkill은 노이즈가 크기 때문에 승률을 선택.

**티어 기준**

| 티어 | 승률 기준 | 최소 경기 수 |
|------|-----------|-------------|
| S | 65% 이상 | 3경기 |
| A | 55% ~ 65% | 3경기 |
| B | 45% ~ 55% | 3경기 |
| C | 35% ~ 45% | 3경기 |
| D | 35% 미만 | 3경기 |
| ? (unranked) | — | 3경기 미만 |

**정렬 기준**: 티어 순 → 같은 티어 내 승률 내림차순.

**상수 위치**: `MIN_GAMES`, `TIER_THRESHOLDS` 모두 `tier.ts` 상단에 집중. 기준 변경 시 이 파일만 수정하면 된다.

### 개인 전적 조회 (`src/lib/profile.ts`)

- `getStreamerProfile(id, streamers, matches)` — 단일 스트리머의 `PlayerStats` 반환. 내부적으로 `calcPlayerStats`를 위임해 재계산. 존재하지 않는 ID → `null`.
- `getRecentMatches(id, matches, n=6)` — 해당 스트리머가 참여한 최근 n경기를 날짜 내림차순 반환.

### 스크린샷 OCR (`src/app/api/parse-screenshot/route.ts`)

`POST /api/parse-screenshot` — multipart/form-data로 이미지를 받아 Gemini `gemini-1.5-flash`에 전달.  
프롬프트에 열 순서(킬·어시·데스·공성딜·영웅딜·힐량·자기힐·경험치기여)를 명시해 `ParsedMatch` JSON으로 반환.  
비용: 약 $0.001/이미지. `GEMINI_API_KEY` 환경변수 필요 (서버 전용, `NEXT_PUBLIC_` 접두어 없음).

### 테마 시스템 (`src/lib/theme.ts`)

- `resolveTheme(stored: string | null): 'dark' | 'light'` — localStorage 값을 받아 유효한 테마를 반환. `null`·알 수 없는 값 → `'dark'` 폴백.
- `SiteHeader`가 마운트 시 localStorage를 읽어 `document.documentElement`의 `data-theme` 속성을 설정.
- `layout.tsx` `<head>`에 인라인 스크립트로 하이드레이션 전 테마를 적용해 플리커 방지.
- 라이트모드: `[data-theme="light"]`로 `light.css`의 모든 토큰 오버라이드가 자동 적용. 다크모드가 기본값(별도 클래스 불필요).

### 지원 맵 목록 (`src/app/matches/new/page.tsx`)

히어로즈 오브 더 스톰 공식 맵 11종:
뒤틀린 식물원, 공포의 정원, 하늘 신전, 용의 둥지, 공허의 파도,
거미 여왕의 무덤, 영원의 전쟁터, 탑승구 만, 불지옥 신단, 볼스카야 공장, 알터랙 고개

---

## 8. 디자인 시스템

Claude Design(claude.ai/design)에서 제작한 핸드오프 번들. `claudecode-design/` 폴더에 위치.

### 브랜드 정체성

- **CHEESE(치지직)**: 네온 그린 `#00FFA3` + 스캔라인 텍스처 + 다크 배경. "전파 잡음(치지직)" 정체성.
- **Heroes of the Storm**: 헥사곤 모티프, 티어 배지, 스카이 블루 `#80D0F0` 보조색.

### 핵심 토큰

| 범주 | 주요 변수 |
|------|-----------|
| 배경 | `--ink-950 #0A0E15`, `--surface-card`, `--surface-raise` |
| 브랜드 | `--cheese-green #00FFA3`, `--cheese-blue #80D0F0` |
| 티어 | `--tier-s` (로즈) · `--tier-a` (오렌지) · `--tier-b` (골드) · `--tier-c` (그린) · `--tier-d` (블루) |
| 효과 | `--border-glow`, `--glow-green-soft`, `--grad-sweep` |

### 폰트

- **Pretendard**: 한국어 본문·UI (jsDelivr CDN)
- **Saira / Saira Condensed**: 디스플레이 헤딩·숫자 (Google Fonts)

### 구현 방식

CSS 변수 토큰을 `src/styles/tokens/`에 파일별로 분리, `globals.css`에서 `@import`로 적재.  
모든 컴포넌트는 인라인 스타일에 DS 토큰(`var(--...)`)만 사용해 라이트/다크 전환이 자동으로 이루어진다.  
`_ds_bundle.js`는 레퍼런스용으로만 참조, 프로덕션에 직접 로드하지 않는다.

### 라이트모드

`src/styles/tokens/light.css`에 `[data-theme="light"]` 셀렉터로 의미 토큰 전체를 오버라이드.  
다크모드(기본)에서 `--accent: var(--cheese-green)` (네온 그린), 라이트모드에서 `--accent: var(--cheese-blue-lo)` (히어로익 블루)로 전환. 모든 컴포넌트는 `var(--accent)`를 읽으므로 별도 조건 분기 없이 자동 전환된다.

### 페이지 목업 파일

| 파일 | 내용 |
|------|------|
| `dash-tierlist.jsx` | 티어리스트 하이파이 (가로 티어 행) |
| `dash-matchroom.jsx` | 경기 목록 하이파이 (타임라인 확장 카드) |
| `dash-profile.jsx` | 개인 전적 하이파이 (사이드바 + 메인 피드) |
| `wf-*.jsx` | 위 3개의 와이어프레임 시안 A/B 버전 |

---

## 9. 에이전트 스킬 구성

이 프로젝트는 [Matt Pocock의 Claude Code 스킬 패키지](https://github.com/mattpocock/skills)를 사용한다.
스킬은 `.claude/skills/` 에 설치되어 있으며, 슬래시 커맨드로 호출한다.

### 설치된 스킬 목록

| 스킬 | 커맨드 | 역할 |
|------|--------|------|
| diagnose | `/diagnose` | 버그 진단 루프 (재현→가설→계측→수정→회귀테스트) |
| tdd | `/tdd` | 테스트 주도 개발 red→green→refactor |
| improve-codebase-architecture | `/improve-codebase-architecture` | 아키텍처 개선 기회 탐색, HTML 리포트 생성 |
| grill-with-docs | `/grill-with-docs` | 설계 검증 인터뷰 + CONTEXT.md/ADR 문서화 |
| prototype | `/prototype` | UI 또는 로직 프로토타입 빠른 생성 |
| to-issues | `/to-issues` | 계획 → GitHub 이슈 수직 슬라이스 분해 |
| to-prd | `/to-prd` | 대화 컨텍스트 → PRD 작성 |
| triage | `/triage` | 이슈 분류 워크플로 |
| zoom-out | `/zoom-out` | 코드베이스 전체 조망 |
| caveman | `/caveman` | 간결 응답 모드 (토큰 절약) |

### 스킬이 참조하는 파일

| 파일 | 참조하는 스킬 | 역할 |
|------|--------------|------|
| `CONTEXT.md` | `diagnose`, `tdd`, `improve-codebase-architecture`, `grill-with-docs` | 도메인 용어 사전 |
| `docs/adr/` | `improve-codebase-architecture`, `tdd`, `grill-with-docs` | 아키텍처 결정 기록 |
| `docs/agents/issue-tracker.md` | `to-issues`, `triage`, `to-prd` | 이슈 트래커 설정 (GitHub Issues + gh CLI) |
| `docs/agents/triage-labels.md` | `triage` | 레이블 매핑 (needs-triage 등 5종) |
| `docs/agents/domain.md` | 전체 | 도메인 문서 위치 규칙 |

### 이번 세션에서 사용한 스킬 흐름

```
/setup-matt-pocock-skills   → 스킬 인프라 구성 (docs/agents/ 생성)
/grill-with-docs            → 디자인 시스템 검증 + 스키마 결정 + CONTEXT.md 작성
/to-issues                  → GitHub 이슈 #1~#7 등록 (1차: MVP 리디자인)
/grill-with-docs (2차)      → req.md 압박 면접 → 모순 해소(티어 이원화·진형 중립화 등) + CONTEXT 5항목·ADR-0005
/to-issues (2차)            → GitHub 이슈 #13~#25 등록 (2차: 개선 13슬라이스)
```

### GitHub 이슈 현황

| # | 제목 | 상태 |
|---|------|------|
| [#1](https://github.com/hongci9999/CheesStorm-website/issues/1) | 디자인 시스템 토큰 + 글로벌 레이아웃 | ✅ 완료 |
| [#2](https://github.com/hongci9999/CheesStorm-website/issues/2) | Match · Streamer 스키마 마이그레이션 | ✅ 완료 |
| [#3](https://github.com/hongci9999/CheesStorm-website/issues/3) | 티어리스트 페이지 리디자인 | ✅ 완료 |
| [#4](https://github.com/hongci9999/CheesStorm-website/issues/4) | 경기 등록 폼 업데이트 + 스크린샷 OCR | ✅ 완료 |
| [#5](https://github.com/hongci9999/CheesStorm-website/issues/5) | 경기 목록 페이지 리디자인 | ✅ 완료 |
| [#6](https://github.com/hongci9999/CheesStorm-website/issues/6) | 스트리머 목록 업데이트 (포지션 선택) | ✅ 완료 |
| [#7](https://github.com/hongci9999/CheesStorm-website/issues/7) | 개인 전적 프로필 페이지 | ✅ 완료 |

#### 2차 — 개선 (req.md → 13슬라이스, 착수 대기)

| # | 제목 | Blocked by | 라벨 |
|---|------|-----------|------|
| [#13](https://github.com/hongci9999/CheesStorm-website/issues/13) | 티어리스트 정리 (검색 삭제·등급문구 삭제·클릭 이동) | — | agent |
| [#14](https://github.com/hongci9999/CheesStorm-website/issues/14) | 스트리머 목록 가나다순 정렬 | — | agent |
| [#15](https://github.com/hongci9999/CheesStorm-website/issues/15) | 기록실 분류탭 제거 + 확장 시 팀별 상세 스탯 | — | agent |
| [#16](https://github.com/hongci9999/CheesStorm-website/issues/16) | 경기 팀 라벨 중립화 + `leftTeam` 진영 기록 | — | agent |
| [#17](https://github.com/hongci9999/CheesStorm-website/issues/17) | 개인 전적 비주얼 (육각 프로필·계정레벨·좌측바) | — | agent |
| [#18](https://github.com/hongci9999/CheesStorm-website/issues/18) | 메인 티어리스트 3탭 스캐폴드 | #13 | agent |
| [#19](https://github.com/hongci9999/CheesStorm-website/issues/19) | 개인 전적 개요/영웅 2탭 + 영웅 전체 스탯표 | #17 | agent |
| [#20](https://github.com/hongci9999/CheesStorm-website/issues/20) | 영웅 티어리스트 (승률, 최소 3경기) | #18 | agent |
| [#21](https://github.com/hongci9999/CheesStorm-website/issues/21) | 큐레이션 스트리머 티어리스트 (수동, ADR-0005) | #18 | **human** |
| [#22](https://github.com/hongci9999/CheesStorm-website/issues/22) | 개인 전적 전체 매치 보기 | #19 | agent |
| [#23](https://github.com/hongci9999/CheesStorm-website/issues/23) | 시너지 팀원/천적 (최소 3경기) | #19 | agent |
| [#24](https://github.com/hongci9999/CheesStorm-website/issues/24) | 맵별 승률 (맵당 최소 3경기) | #19 | agent |
| [#25](https://github.com/hongci9999/CheesStorm-website/issues/25) | 반응형 패스 (창 축소 대응) | 다수 | agent |

---

## 10. 환경 설정

### 로컬 개발

```bash
# 1. 환경변수 파일 생성
cp .env.local.example .env.local
# .env.local에 Firebase 콘솔에서 복사한 값 입력

# 2. 의존성 설치
npm install

# 3. 개발 서버
npm run dev   # http://localhost:3000
```

### 환경변수 목록

| 키 | 설명 | 출처 |
|----|------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API 키 | Firebase 콘솔 → 프로젝트 설정 → 웹 앱 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth 도메인 | 동일 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 프로젝트 ID | 동일 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage 버킷 | 동일 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 메시징 발신자 ID | 동일 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 앱 ID | 동일 |
| `GEMINI_API_KEY` | Gemini API 키 (서버 전용) | [Google AI Studio](https://aistudio.google.com/app/apikey) |

> `GEMINI_API_KEY`는 `NEXT_PUBLIC_` 접두어를 붙이지 않는다 — 클라이언트에 노출되지 않아야 한다.

### Firebase 초기 세팅 순서

1. [Firebase 콘솔](https://console.firebase.google.com) → 새 프로젝트 생성
2. Firestore Database → 데이터베이스 만들기 → 프로덕션 모드
3. 프로젝트 설정 → 내 앱 → 웹 앱 추가 → SDK 설정 복사 → `.env.local` 작성
4. Firestore 보안 규칙 (개발 초기용):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

---

## 11. 배포

### Vercel 배포 방법

```bash
# Vercel CLI 사용 시
vercel --prod

# 또는 GitHub 연결 후 main 브랜치 push로 자동 배포
```

### Vercel 환경변수 설정

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서
`.env.local`의 키-값을 동일하게 입력.

### Firestore 보안 규칙 (운영용)

MVP 이후 인증을 추가한다면 아래 방향으로 제한:
- 읽기: 전체 허용
- 쓰기: Firebase Auth로 인증된 특정 UID만 허용

---

## 12. 변경 이력

> 형식: `날짜 | 작업 유형 | 내용 | 결정 근거 (선택)`
> 작업 유형: `기능 추가` / `기능 변경` / `버그 수정` / `설계 변경` / `의존성`

| 날짜 | 유형 | 내용 |
|------|------|------|
| 2026-06-10 | 기능 추가 | MVP 초기 구현 — 티어리스트, 경기 결과 목록/입력, 스트리머 관리 |
| 2026-06-10 | 설계 변경 | DB를 Supabase → Firebase Firestore로 변경. 연 2~3주 운영 특성상 Supabase 무료 티어의 1주 비활성 자동 일시정지 문제 때문 |
| 2026-06-10 | 인프라 | Matt Pocock 스킬 패키지 설치 + `/setup-matt-pocock-skills` 실행 (docs/agents/ 생성, CLAUDE.md 업데이트) |
| 2026-06-10 | 인프라 | GitHub remote 연결 (hongci9999/CheesStorm-website) |
| 2026-06-10 | 설계 변경 | `/grill-with-docs` 세션: 디자인 시스템(claudecode-design/) 검토 후 스키마 결정 — 영웅 픽 저장, 롤 필드 추가, MMR 유보, /streamers/[id] 라우트 추가 |
| 2026-06-10 | 문서 | CONTEXT.md 도메인 용어 사전 생성, docs/adr/0001-mmr-deferred.md ADR 생성 |
| 2026-06-10 | 기획 | `/to-issues` 세션: GitHub 이슈 #1~#7 등록 (디자인 리디자인 + 스키마 마이그레이션 작업 분해) |
| 2026-06-10 | 기능 추가 | 이슈 #1~#5: DS 토큰 적용, 스키마 마이그레이션, 티어리스트·경기 목록·경기 입력 페이지 전면 리디자인 |
| 2026-06-10 | 기능 추가 | 스크린샷 OCR 기능: Gemini `gemini-1.5-flash`로 경기 결과 이미지 → 팀 구성·영웅·개인 스탯 자동 추출 (`/api/parse-screenshot`) |
| 2026-06-10 | 기능 추가 | `PlayerMatchStat` 타입 추가 — 킬·어시·데스·공성딜·영웅딜·힐량·자기힐·경험치기여 8개 스탯 기록 |
| 2026-06-11 | 기능 추가 | 이슈 #6: 스트리머 페이지 DS 토큰 전환 + 포지션 선택(토글 칩·역할 뱃지). TDD: `validateStreamerForm` 4테스트 |
| 2026-06-11 | 기능 추가 | 이슈 #7: 개인 전적 프로필 페이지 (`/streamers/[id]`). TDD: `getStreamerProfile`·`getRecentMatches` 4테스트 |
| 2026-06-11 | 기능 추가 | 헤더 DS 적용: `color-mix` 배경·68px·STORM accent색·2줄 탭·활성 underline bar. TDD: `resolveTheme` 4테스트 |
| 2026-06-11 | 기능 추가 | 라이트모드 구현: ☾/☀ 토글 pill, localStorage 영속, 하이드레이션 전 인라인 스크립트(플리커 방지) |
| 2026-06-11 | 버그 수정 | `--sp-7` 토큰 누락 추가, `::selection` 토큰화, 하드코딩 hex/rgba → DS 토큰, `TIER_COLORS` dead code 제거 |
| 2026-06-12 | 설계 변경 | 롤 파생 전환 — `role` 수동 입력 폐지, 내전 기록 최다 영웅 역할군으로 파생(`heroes.ts deriveRole`). `Streamer`에 `accountLevel`·`gameNames`·`profileImageUrl` 추가 |
| 2026-06-12 | 기능 추가 | 경기 도메인 모듈 `match.ts`(outcomeFor·heroOf·statOf), `profile.ts`에 currentStreak·kdaFor, `streamer.ts`에 parseChzzkId |
| 2026-06-12 | 기능 추가 | 스트리머 카드 육각형 개편 — 공용 `HexAvatar`(사진/이니셜 폴백), 벌집 배열(5열 brick, 상하·좌우 균일 간격), 티어색 테두리 + 히오스 보라 토글, 하단 그라데이션(닉네임·계정레벨) |
| 2026-06-12 | 문서 | `/grill-with-docs` 2차: req.md 압박 면접 → 티어 이원화(자동/큐레이션)·영웅 페이지 컬럼·파생 통계 3경기 임계·진형 중립화 결정. CONTEXT 5항목 추가, `docs/adr/0005` 신규, 0002~0004 ADR 반영 |
| 2026-06-12 | 기획 | `/to-issues` 2차: GitHub 이슈 #13~#25 등록 (개선 13슬라이스, 의존순). 배포 확장 계획(천명/1-2일 → Blaze+캐싱) 메모 기록 |
