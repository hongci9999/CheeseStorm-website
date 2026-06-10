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
│   ├── layout.tsx          # 글로벌 레이아웃 + 네비게이션
│   ├── page.tsx            # 메인 (티어리스트)
│   ├── matches/
│   │   ├── page.tsx        # 경기 결과 목록
│   │   └── new/page.tsx    # 경기 결과 입력
│   └── streamers/
│       └── page.tsx        # 스트리머 추가/삭제
└── lib/
    ├── firebase.ts         # Firebase 초기화
    ├── firestore.ts        # Firestore CRUD
    ├── tier.ts             # 티어 계산 로직 (승률 기반)
    └── types.ts            # TypeScript 타입
```

## Firestore 컬렉션 구조

- `streamers`: `{ name, chzzkId?, createdAt }`
- `matches`: `{ date, blueTeam: string[], redTeam: string[], winner: 'blue'|'red', map?, note?, createdAt }`

## 개발 환경 설정

```bash
# .env.local.example 복사 후 Firebase 값 채우기
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
