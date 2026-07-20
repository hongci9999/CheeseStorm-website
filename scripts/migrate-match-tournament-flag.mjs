// 일회성 마이그레이션: tournamentGames 태그를 matches 문서의 tournament 플래그로 비정규화.
// 배경: 대회 경기를 Elo에서 제외하게 됐는데(ADR-0022), 홈은 클라이언트에서 matches만 읽어
// Elo를 계산하므로 tournamentGames를 추가로 읽지 않고 걸러내려면 경기 문서에 플래그가 필요하다.
// 이후로는 linkMatchToTournament/unlinkMatchFromTournament가 두 곳을 함께 갱신한다.
//
// 사용법:
//   node scripts/migrate-match-tournament-flag.mjs          # 드라이런 — 변경 계획만 출력
//   node scripts/migrate-match-tournament-flag.mjs --apply  # 실제 적용
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

// .env.local 수동 파싱 (dotenv 의존성 없이)
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64
  ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
  : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore();
const [links, matches] = await Promise.all([
  db.collection('tournamentGames').get(),
  db.collection('matches').get(),
]);

const taggedIds = new Set(links.docs.map((d) => d.id));
console.log(`[${APPLY ? 'APPLY' : 'DRY-RUN'}] 대회 태그 ${taggedIds.size}건 / 전체 경기 ${matches.size}건\n`);

// 플래그를 세워야 할 경기(태그 있는데 플래그 없음)와 내려야 할 경기(플래그 있는데 태그 없음).
const toSet = [];
const toClear = [];
for (const doc of matches.docs) {
  const flagged = doc.data().tournament === true;
  const tagged = taggedIds.has(doc.id);
  if (tagged && !flagged) toSet.push(doc.id);
  if (!tagged && flagged) toClear.push(doc.id);
}

// 태그는 있는데 경기 문서가 없는 고아 태그 — 마이그레이션 대상은 아니고 보고만 한다.
const matchIds = new Set(matches.docs.map((d) => d.id));
const orphans = [...taggedIds].filter((id) => !matchIds.has(id));

console.log(`플래그 설정 대상: ${toSet.length}건`);
for (const id of toSet) console.log(`  + ${id}`);
console.log(`플래그 해제 대상: ${toClear.length}건`);
for (const id of toClear) console.log(`  - ${id}`);
if (orphans.length) {
  console.log(`\n경고: 경기 문서 없는 고아 태그 ${orphans.length}건 — 수동 확인 필요`);
  for (const id of orphans) console.log(`  ? ${id}`);
}

if (!APPLY) {
  console.log('\n드라이런입니다. 실제 적용하려면 --apply 를 붙이세요.');
  process.exit(0);
}

if (toSet.length === 0 && toClear.length === 0) {
  console.log('\n변경할 문서가 없습니다.');
  process.exit(0);
}

const batch = db.batch();
for (const id of toSet) batch.update(db.collection('matches').doc(id), { tournament: true });
for (const id of toClear) batch.update(db.collection('matches').doc(id), { tournament: FieldValue.delete() });
await batch.commit();
console.log(`\n완료: ${toSet.length}건 설정, ${toClear.length}건 해제.`);
console.log('경기를 한 건 수정하거나 /api/revalidate 로 stats 태그를 무효화해 Elo를 재집계하세요.');
