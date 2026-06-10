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
| **현재 상태** | MVP 구현 완료, Firebase 연결 후 배포 가능 |
| **스택 요약** | Next.js 15 · Firebase Firestore · Tailwind CSS v4 · Vercel |

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
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # 전역 레이아웃 (헤더 + 네비게이션)
│   │   ├── page.tsx                # / — 티어리스트
│   │   ├── matches/
│   │   │   ├── page.tsx            # /matches — 경기 결과 목록
│   │   │   └── new/
│   │   │       └── page.tsx        # /matches/new — 경기 결과 입력
│   │   └── streamers/
│   │       ├── page.tsx            # /streamers — 스트리머 추가/삭제
│   │       └── [id]/
│   │           └── page.tsx        # /streamers/[id] — 개인 전적 (구현 예정)
│   ├── components/
│   │   └── ui/                     # shadcn/ui 컴포넌트
│   └── lib/
│       ├── firebase.ts             # Firebase 앱 초기화
│       ├── firestore.ts            # Firestore CRUD 함수 모음
│       ├── tier.ts                 # 티어 계산 로직 + 상수
│       ├── types.ts                # 공통 TypeScript 타입
│       └── utils.ts                # shadcn 유틸 (cn 함수)
├── claudecode-design/              # Claude Design 핸드오프 번들 (디자인 레퍼런스)
│   └── project/
│       ├── _ds/                    # 디자인 시스템 토큰 + 컴포넌트 번들
│       ├── dash-*.jsx              # 하이파이 페이지 목업
│       └── wf-*.jsx                # 와이어프레임 목업
├── docs/
│   └── adr/
│       └── 0001-mmr-deferred.md   # ADR: MMR 시스템 구현 유보
├── CONTEXT.md                      # 도메인 용어 사전 (에이전트 스킬 참조)
├── CLAUDE.md                       # Claude Code 작업 지침 + 에이전트 스킬 구성
├── .env.local.example              # 환경변수 템플릿
└── PROJECT.md                      # 이 문서
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
  role?: '탱커' | '투사' | '암살자' | '지원가' | '전문가';        // 주 포지션 (이슈 #2)
  createdAt: Timestamp;
}
```

### `matches`

경기 한 건의 결과.

```typescript
{
  id: string;                      // Firestore 자동 생성 ID
  date: Timestamp;                 // 경기 날짜
  blueTeam: [string, string][];    // [플레이어명, 영웅명] 쌍 배열 (이슈 #2)
  redTeam: [string, string][];     // [플레이어명, 영웅명] 쌍 배열 (이슈 #2)
  winner: 'blue' | 'red';          // 승리 진영
  map?: string;                    // 맵 이름
  dur?: string;                    // 경기시간 (예: "21:04") (이슈 #2)
  note?: string;                   // 메모
  createdAt: Timestamp;
}
```

> **주의**: `blueTeam`/`redTeam`이 초기 구현의 `string[]`에서 `[string, string][]`로 변경됨.
> Firestore에 기존 데이터가 있다면 마이그레이션 필요.

### 설계 결정

- **플레이어 통계를 별도 컬렉션으로 저장하지 않는 이유**: 경기 수가 적어(수십 건 수준) 클라이언트에서 전체 matches를 내려받아 실시간 계산해도 충분하다. 캐시나 집계 컬렉션은 데이터 정합성 관리 부담만 늘린다.
- **MMR 미구현**: 초기에는 승률만으로 충분. 향후 Elo 방식 추가 예정. `docs/adr/0001-mmr-deferred.md` 참조.

---

## 6. 페이지 구성

| 경로 | 제목 | 역할 | 인증 필요 |
|------|------|------|-----------|
| `/` | 티어리스트 | 전체 스트리머 S~D 티어 + 전적 표시 | 없음 |
| `/matches` | 경기 결과 | 전체 경기 목록 (타임라인 피드), 클릭 시 라인업 확장 | 없음 |
| `/matches/new` | 경기 입력 | 팀 구성·영웅픽·맵·경기시간·승리팀 입력 | 없음 (MVP) |
| `/streamers` | 스트리머 관리 | 스트리머 추가(롤 포함)·삭제, 클릭 시 프로필 이동 | 없음 (MVP) |
| `/streamers/[id]` | 개인 전적 | 사이드바(기본 정보) + 영웅별 승률 + 최근 매치 | 없음 |

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

CSS 변수 토큰을 `globals.css`에 직접 정의, Tailwind `arbitrary value`(`text-[var(--cheese-green)]`)로 사용. `_ds_bundle.js`는 레퍼런스용으로만 참조, 프로덕션에 직접 로드하지 않는다.

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
/to-issues                  → GitHub 이슈 #1~#7 등록
```

### GitHub 이슈 현황 및 권장 스킬

| # | 제목 | 블로커 | 권장 스킬 | 이유 |
|---|------|--------|-----------|------|
| [#1](https://github.com/hongci9999/CheesStorm-website/issues/1) | 디자인 시스템 토큰 + 글로벌 레이아웃 | 없음 | 없음 | CSS 변수 + 폰트 로드, 단순 작업 |
| [#2](https://github.com/hongci9999/CheesStorm-website/issues/2) | Match · Streamer 스키마 마이그레이션 | 없음 | `/tdd` | 타입 변경 + 함수 수정, 회귀 위험 |
| [#3](https://github.com/hongci9999/CheesStorm-website/issues/3) | 티어리스트 페이지 리디자인 | #1 | `/prototype` | 헥사곤 clip-path·glow 등 CSS 결정 많음 |
| [#4](https://github.com/hongci9999/CheesStorm-website/issues/4) | 경기 등록 폼 업데이트 | #2 | `/tdd` | 5인 미만 제출 불가 등 유효성 규칙 명확 |
| [#5](https://github.com/hongci9999/CheesStorm-website/issues/5) | 경기 목록 페이지 리디자인 | #1 #2 | `/prototype` | 타임라인 인라인 확장 인터랙션 검증 필요 |
| [#6](https://github.com/hongci9999/CheesStorm-website/issues/6) | 스트리머 목록 업데이트 | #1 #2 | 없음 | 롤 select + 링크 연결, 단순 작업 |
| [#7](https://github.com/hongci9999/CheesStorm-website/issues/7) | 개인 전적 프로필 페이지 | #2 #6 | `/tdd` + `/diagnose` | 영웅별 승률 집계 로직 복잡, 엣지 케이스 多 |

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
| 2026-06-10 | 인프라 | GitHub remote 연결 (hongci9999/CheesStorm-website), gh CLI 설치 + 인증 |
| 2026-06-10 | 설계 변경 | `/grill-with-docs` 세션: 디자인 시스템(claudecode-design/) 검토 후 스키마 결정 — 영웅 픽 저장, 롤 필드 추가, MMR 유보, /streamers/[id] 라우트 추가 |
| 2026-06-10 | 문서 | CONTEXT.md 도메인 용어 사전 생성, docs/adr/0001-mmr-deferred.md ADR 생성 |
| 2026-06-10 | 기획 | `/to-issues` 세션: GitHub 이슈 #1~#7 등록 (디자인 리디자인 + 스키마 마이그레이션 작업 분해) |
