# Cheesestorm

## 프로젝트 개요

치지직 스트리머들의 히어로즈 오브 더 스톰(HotS) 내전 결과를 기록하고 티어리스트를 볼 수 있는 웹사이트.
연 2-3주만 활발히 운영되는 특성에 맞춰 Firebase(Spark 무료 플랜)를 사용, 유휴 시 비용 0원.

## 기술 스택

- **언어/런타임**: TypeScript / Node.js
- **프레임워크**: Next.js 15 (App Router)
- **DB**: Firebase Firestore (Spark 무료 플랜)
- **스타일**: Tailwind CSS v4 + shadcn/ui
- **배포**: Vercel

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx              # 글로벌 레이아웃 (SiteHeader 포함)
│   ├── page.tsx                # 메인 (티어리스트)
│   ├── api/
│   │   ├── auth/               # 인증 엔드포인트
│   │   │   ├── login/route.ts        # 로그인 시작
│   │   │   ├── callback/chzzk/route.ts # OAuth 콜백 (치지직)
│   │   │   ├── logout/route.ts       # 로그아웃
│   │   │   ├── me/route.ts           # 현재 세션 조회
│   │   │   └── dev-login/route.ts    # 개발용 임시 로그인
│   │   └── parse-screenshot/
│   │       └── route.ts        # Gemini API 스크린샷 파싱 엔드포인트
│   ├── dev-login/
│   │   └── page.tsx            # 개발용 임시 로그인 페이지
│   ├── guide/
│   │   └── page.tsx            # 사용방법 안내 페이지
│   ├── matches/
│   │   ├── page.tsx            # 경기 결과 목록 (타임라인)
│   │   └── new/page.tsx        # 경기 결과 입력 (슬롯 기반 + OCR)
│   └── streamers/
│       ├── page.tsx            # 스트리머 추가/삭제 (포지션 선택 포함)
│       └── [id]/page.tsx       # 개인 전적 프로필
├── components/
│   └── site-header.tsx         # 클라이언트 헤더 (네비 + 테마 토글)
├── hooks/
│   └── use-auth.ts             # 클라이언트 인증 상태 훅
├── lib/
│   ├── firebase.ts             # Firebase 초기화
│   ├── firestore.ts            # Firestore CRUD
│   ├── tier.ts                 # 티어 계산 로직 (승률 기반)
│   ├── match.ts                # 단일 경기 질의 (outcomeFor, heroOf, statOf)
│   ├── heroes.ts               # 영웅→역할군 매핑, deriveRole, roleAffinity
│   ├── profile.ts              # getStreamerProfile, getRecentMatches, currentStreak, kdaFor
│   ├── streamer.ts             # validateStreamerForm, parseChzzkId
│   ├── theme.ts                # resolveTheme (다크/라이트)
│   ├── auth-permissions.ts     # 권한 레벨 정의 (viewer/streamer/admin)
│   ├── chzzk-auth.ts           # 치지직 OAuth 2.0 클라이언트
│   ├── session.ts              # JWT 세션 관리 (jose 기반)
│   └── types.ts                # TypeScript 타입
├── middleware.ts               # 인증 미들웨어 (보호된 라우트)
├── styles/tokens/              # DS 토큰 CSS 파일 모음
└── test/fixtures/              # Vitest용 목 데이터
```

## Firestore 컬렉션 구조

- `streamers`: `{ name, chzzkId?, accountLevel?, gameNames?, profileImageUrl?, role?(레거시), createdAt }` — 롤은 저장 안 하고 내전 기록에서 파생
- `matches`: `{ date, blueTeam: [string,string][], redTeam: [string,string][], winner: 'blue'|'red', blueStats?: PlayerMatchStat[], redStats?: PlayerMatchStat[], map?, dur?, note?, createdAt }`

## 개발 환경 설정

```bash
# .env.local.example 복사 후 Firebase + Gemini 값 채우기
cp .env.local.example .env.local

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## Firebase 설정 순서

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트 생성
2. Firestore Database → 프로덕션 모드로 생성
3. 프로젝트 설정 → 웹 앱 추가 → SDK 설정값을 `.env.local`에 복사
4. Firestore 규칙: 개발 중엔 `allow read, write: if true;`, 운영 시 적절히 제한

## PRD — 제품 의도 및 방향

### 목적

연 1회 HotS 대회를 대비한 내전 운영 도구.

- 내전 전적 기록
- 밸런스 있는 팀 선정 보조 (운영자가 수동으로 판단, 티어리스트는 참고 자료)
- 스트리머 본인 전적 확인
- 스트리머들의 내전 참여 동기 부여

### 타겟

공개 페이지. 시청자 + 참여 스트리머 + 운영자 모두 접근 가능.

### 티어리스트 구조

**자동 탭 (참고용)**

- 내전은 팀이 의도적으로 밸런싱되므로 승률만으로 개인 실력 측정 불가
- 전프로도 승률에 따라 C티어에 배정될 수 있는 구조적 한계 존재
- 자동 티어는 실력 지표가 아닌 전적 요약으로만 사용
- 표본 최소 5경기 이상일 때만 티어 부여, 미만은 ? 티어
- 카드: 아바타 + 이름만 표시 (심플 유지)

**큐레이션 탭 (실제 티어)**

- 운영자 + 권한 있는 스트리머가 드래그앤드롭으로 직접 배정
- 이것이 팀 편성 시 실제로 참고하는 지표

### 인증 및 권한

- **인증 방식**: 치지직 OAuth 2.0
- **최고 운영자**: env 변수에 chzzkId 고정
- **자동 권한 부여**: 로그인한 chzzkId가 `streamers` 컬렉션에 등록된 스트리머면 운영 권한 자동 부여
- **일반 시청자**: 읽기 전용 (인증 불필요)
- **권한 있는 스트리머**: 경기 입력 + 큐레이션 티어 편집 가능

> 인증 구현 완료 (치지직 OAuth 2.0 + jose JWT, NextAuth 미사용)

### 프로필 페이지 핵심 정보

팀 편성 관점에서 중요한 두 가지:

1. 역할군별 플레이 분포 (어느 포지션 가능한지)
2. 영웅 풀 (어떤 영웅을 주로 플레이하는지)

### 시즌 개념

내전은 특정 기간에 집중되며 연 1~3회 비주기적으로 시즌이 발생.
현재는 첫 시즌이라 전체 데이터 = 시즌 1 데이터.
향후 시즌이 쌓이면 `matches.season` 필드로 격리 필요 — 미리 스키마에 추가 권장.

### 향후 고민 (미확정)

- 대회 운영 보조 기능 (대진표, 점수판 등)
- UX 금지 원칙 (아직 미정)

---

## 티어 기준 (혼합 점수)

승률과 스탯 점수를 가중 평균한 **혼합 점수**로 티어를 결정한다.  
`finalScore = α × winRate + (1-α) × statWinRate` (α는 스탯 커버리지에 따라 0.35~0.80 동적 조정)  
상세 공식·파라미터 튜닝: [`docs/tierlist-logic.md`](docs/tierlist-logic.md)

| 티어 | 혼합 점수 | 최소 경기  |
| ---- | --------- | ---------- |
| S    | 65%+      | 5경기      |
| A    | 55~65%    | 5경기      |
| B    | 45~55%    | 5경기      |
| C    | 35~45%    | 5경기      |
| D    | ~35%      | 5경기      |
| ?    | —         | 5경기 미만 |

변경 가능

## 코딩 컨벤션

- 코멘트는 한국어로 작성
- 함수명/변수명은 영어 camelCase
- 파일명은 kebab-case (Next.js 페이지는 page.tsx 고정)

## Agent skills

### Issue tracker

Issues live in GitHub Issues (gh CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one CONTEXT.md + docs/adr/ at root. See `docs/agents/domain.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
