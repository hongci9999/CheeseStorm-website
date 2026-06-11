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
│   │   └── parse-screenshot/
│   │       └── route.ts        # Gemini API 스크린샷 파싱 엔드포인트
│   ├── matches/
│   │   ├── page.tsx            # 경기 결과 목록 (타임라인)
│   │   └── new/page.tsx        # 경기 결과 입력 (슬롯 기반 + OCR)
│   └── streamers/
│       ├── page.tsx            # 스트리머 추가/삭제 (포지션 선택 포함)
│       └── [id]/page.tsx       # 개인 전적 프로필
├── components/
│   └── site-header.tsx         # 클라이언트 헤더 (네비 + 테마 토글)
├── lib/
│   ├── firebase.ts             # Firebase 초기화
│   ├── firestore.ts            # Firestore CRUD
│   ├── tier.ts                 # 티어 계산 로직 (승률 기반)
│   ├── match.ts                # 단일 경기 질의 (outcomeFor, heroOf, statOf)
│   ├── heroes.ts               # 영웅→역할군 매핑, deriveRole, roleAffinity
│   ├── profile.ts              # getStreamerProfile, getRecentMatches, currentStreak, kdaFor
│   ├── streamer.ts             # validateStreamerForm, parseChzzkId
│   ├── theme.ts                # resolveTheme (다크/라이트)
│   └── types.ts                # TypeScript 타입
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

## 티어 기준 (승률)

| 티어 | 승률 | 최소 경기 |
|------|------|---------|
| S | 65%+ | 3경기 |
| A | 55~65% | 3경기 |
| B | 45~55% | 3경기 |
| C | 35~45% | 3경기 |
| D | ~35% | 3경기 |
| ? | - | 3경기 미만 |

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
