# ADR-0015 — refreshStats reads를 Admin SDK로 교체

- **날짜**: 2026-06-16
- **상태**: 채택 및 구현 완료
- **관련**: ADR-0013 (경기기록 서버 컴포넌트 전환)

## 증상

배포 환경에서 경기를 추가·수정·삭제하거나 스트리머를 추가·삭제할 때마다
`stats/current`의 `playerStats`, `heroTiers`, `profiles`가 빈 배열/빈 맵으로
덮어써져 홈 페이지 티어리스트와 영웅 티어리스트가 공백이 됐다.

## 버그 도입 경위

ADR-0013에서 모든 뮤테이션을 클라이언트 직접 호출 → API 라우트로 이전했다.

```
[ADR-0013 이전] 클라이언트 직접 호출
브라우저 → firestore.ts::addMatch()
              → void refreshStats()   ← 브라우저에서 실행
              → 로그인 유저 권한으로 Firestore reads ✓
              → stats/current 정상 저장

[ADR-0013 이후] API 라우트 경유
브라우저 → POST /api/matches
              → firestore-admin.ts::addMatch()
              → void refreshStats()   ← 서버에서 실행
              → getStreamers/getMatches from firestore.ts (CLIENT SDK)
              → 비인증 상태로 Firestore reads
              → 보안 규칙에 막혀 [] 반환
              → stats/current에 빈 배열 덮어씀 ✗
```

`firestore-admin.ts`의 `refreshStats()`는 writes에 Admin SDK를 쓰지만,
reads는 `firestore.ts`를 import해 CLIENT SDK를 사용했다.
CLIENT SDK는 브라우저용으로 설계됐으며 서버 컨텍스트에서는
유저 인증 토큰이 없으므로 Firestore 보안 규칙에 의해 차단된다.

## 왜 로컬 개발에서는 괜찮았나

로컬 개발 환경(또는 초기 배포)의 Firestore 보안 규칙이
`allow read, write: if true;` (전체 허용)로 설정돼 있으면
비인증 reads도 성공하므로 문제가 드러나지 않는다.

프로덕션 규칙으로 바꾸는 순간, 또는 처음부터 프로덕션 규칙이었다면
ADR-0013 이후 첫 뮤테이션 시점부터 `stats/current`가 빈 데이터로 덮였다.

## 수정

`firestore-admin.ts`에 Admin SDK 전용 read 함수를 추가하고
`refreshStats()`가 이를 사용하도록 교체했다.

```ts
// 추가: Admin SDK reads — 보안 규칙 우회, refreshStats() 전용
async function getStreamersAdmin(): Promise<Streamer[]> {
  const snap = await getAdminDb().collection('streamers').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Streamer));
}
async function getMatchesAdmin(): Promise<Match[]> {
  const snap = await getAdminDb().collection('matches').orderBy('date', 'desc').get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      blueTeam: unpackTeam(data.blueTeam),
      redTeam: unpackTeam(data.redTeam),
      date: data.date.toDate(),
      createdAt: data.createdAt.toDate(),
    } as Match;
  });
}

// 변경 전
const [streamers, matches] = await Promise.all([getStreamers({ fresh: true }), getMatches()]);

// 변경 후
const [streamers, matches] = await Promise.all([getStreamersAdmin(), getMatchesAdmin()]);
```

Admin SDK는 서비스 계정 인증을 사용하므로 Firestore 보안 규칙을 우회해
항상 실제 데이터를 반환한다.

## 원칙

> `firestore-admin.ts`의 모든 reads와 writes는 Admin SDK를 사용해야 한다.
> CLIENT SDK(`firestore.ts`)를 server-only 파일에서 import하는 것은
> 보안 규칙 적용 여부에 따라 동작이 달라지므로 금지.
