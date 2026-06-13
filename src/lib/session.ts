// JWT 세션 관리 — jose 사용 (Edge Runtime 호환).
// 쿠키에 httpOnly로 저장하며 서버에서만 읽는다.

import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'cs-session';
export const SESSION_EXPIRY_SEC = 7 * 24 * 60 * 60; // 7일

export type AppRole = 'viewer' | 'streamer' | 'admin';

export interface SessionPayload {
  chzzkId: string;
  name: string;
  role: AppRole;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET이 설정되지 않았거나 32자 미만입니다. openssl rand -base64 32 로 생성하세요.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      chzzkId: payload.chzzkId as string,
      name: payload.name as string,
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}
