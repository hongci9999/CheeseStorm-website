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
8. [환경 설정](#8-환경-설정)
9. [배포](#9-배포)
10. [변경 이력](#10-변경-이력)

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
│   │       └── page.tsx            # /streamers — 스트리머 추가/삭제
│   ├── components/
│   │   └── ui/                     # shadcn/ui 컴포넌트 (자동 생성, 직접 수정 가능)
│   └── lib/
│       ├── firebase.ts             # Firebase 앱 초기화
│       ├── firestore.ts            # Firestore CRUD 함수 모음
│       ├── tier.ts                 # 티어 계산 로직 + 상수
│       ├── types.ts                # 공통 TypeScript 타입
│       └── utils.ts                # shadcn 유틸 (cn 함수)
├── public/
├── .env.local.example              # 환경변수 템플릿 (값 없이 키만)
├── .env.local                      # 실제 환경변수 (gitignore됨)
├── CLAUDE.md                       # Claude Code 작업 지침
└── PROJECT.md                      # 이 문서
```

---

## 5. 데이터 모델

Firebase Firestore 컬렉션 구조.

### `streamers`

내전에 참가하는 스트리머 정보.

```typescript
{
  id: string;          // Firestore 자동 생성 ID
  name: string;        // 닉네임 (필수)
  chzzkId?: string;    // 치지직 채널 ID (선택, URL 링크용)
  createdAt: Timestamp;
}
```

### `matches`

경기 한 건의 결과.

```typescript
{
  id: string;              // Firestore 자동 생성 ID
  date: Timestamp;         // 경기 날짜
  blueTeam: string[];      // 블루팀 streamer ID 배열
  redTeam: string[];       // 레드팀 streamer ID 배열
  winner: 'blue' | 'red';  // 승리 팀
  map?: string;            // 맵 이름 (선택)
  note?: string;           // 메모 (선택)
  createdAt: Timestamp;
}
```

### 설계 결정

- **플레이어 통계를 별도 컬렉션으로 저장하지 않는 이유**: 경기 수가 적어(수십 건 수준) 클라이언트에서 전체 matches를 내려받아 실시간 계산해도 충분하다. 캐시나 집계 컬렉션은 데이터 정합성 관리 부담만 늘린다.
- **스트리머 ID를 matches에 직접 embed하는 이유**: 스트리머가 삭제되어도 경기 기록은 유지된다. 이름 변경 시에는 streamers 문서만 수정하면 UI에서 자동 반영.

---

## 6. 페이지 구성

| 경로 | 제목 | 역할 | 인증 필요 |
|------|------|------|-----------|
| `/` | 티어리스트 | 전체 스트리머 S~D 티어 + 전적 표시 | 없음 |
| `/matches` | 경기 결과 | 전체 경기 목록 (최신순), 삭제 가능 | 없음 |
| `/matches/new` | 경기 입력 | 팀 구성·맵·승리팀 입력 후 저장 | 없음 (MVP) |
| `/streamers` | 스트리머 관리 | 스트리머 추가·삭제 | 없음 (MVP) |

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

## 8. 환경 설정

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

## 9. 배포

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

## 10. 변경 이력

> 형식: `날짜 | 작업 유형 | 내용 | 결정 근거 (선택)`
> 작업 유형: `기능 추가` / `기능 변경` / `버그 수정` / `설계 변경` / `의존성`

| 날짜 | 유형 | 내용 |
|------|------|------|
| 2026-06-10 | 기능 추가 | MVP 초기 구현 — 티어리스트, 경기 결과 목록/입력, 스트리머 관리 |
| 2026-06-10 | 설계 변경 | DB를 Supabase → Firebase Firestore로 변경. 연 2~3주 운영 특성상 Supabase 무료 티어의 1주 비활성 자동 일시정지가 불편하기 때문 |
