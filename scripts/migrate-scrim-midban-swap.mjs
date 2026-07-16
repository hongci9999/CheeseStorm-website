// 일회성 마이그레이션: scrims 컬렉션의 3번째 밴(미드밴)을 팀 간 스왑.
// 배경: sequence.ts 미드밴 순서가 F S → S F로 수정되기 전 입력된 기록은
// 각 팀 3번째 밴이 서로 바뀐 채 저장돼 있음.
//
// 사용법:
//   node scripts/migrate-scrim-midban-swap.mjs          # 드라이런 — 현재 값과 스왑 계획만 출력
//   node scripts/migrate-scrim-midban-swap.mjs --apply  # 실제 적용
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
const snap = await db.collection('scrims').get();
console.log(`[${APPLY ? 'APPLY' : 'DRY-RUN'}] scrims 문서 ${snap.size}건\n`);

const batch = db.batch();
let changed = 0;
for (const doc of snap.docs) {
  const d = doc.data();
  const blue = d.bans?.blue;
  const red = d.bans?.red;
  if (!Array.isArray(blue) || !Array.isArray(red) || blue.length !== 3 || red.length !== 3) {
    console.log(`SKIP ${doc.id} — 밴 배열 형태 이상`, blue, red);
    continue;
  }
  console.log(`${doc.id} (${d.map ?? '?'})`);
  console.log(`  현재: blue=[${blue.join(', ')}] red=[${red.join(', ')}]`);
  console.log(`  스왑: blue[2] ${blue[2]} ↔ red[2] ${red[2]}`);
  if (APPLY) {
    batch.update(doc.ref, {
      bans: { blue: [blue[0], blue[1], red[2]], red: [red[0], red[1], blue[2]] },
    });
  }
  changed++;
}

if (APPLY && changed > 0) {
  await batch.commit();
  console.log(`\n완료 — ${changed}건 수정`);
} else {
  console.log(`\n드라이런 종료 — 대상 ${changed}건. 적용하려면 --apply`);
}
