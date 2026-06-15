import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function resolvePrivateKey(): string | undefined {
  // Vercel 환경에서 \n 처리 불일치 문제를 피하기 위해 base64 인코딩 우선 사용
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: resolvePrivateKey(),
    }),
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
