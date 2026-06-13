// 치지직 OAuth 2.0 인증 헬퍼 (사용자 로그인용).
// Client Credentials 방식(채널 프로필 조회, src/lib/chzzk.ts)과 별개.
// 문서: https://chzzk.gitbook.io/chzzk/chzzk-api/authorization

const OPENAPI_BASE = 'https://openapi.chzzk.naver.com';

function getRedirectUri(): string {
  const base = process.env.AUTH_URL ?? 'http://localhost:3000';
  return `${base}/api/auth/callback/chzzk`;
}

// 치지직 로그인 페이지 URL 생성 (camelCase 파라미터 — 비표준 OAuth)
export function buildChzzkAuthUrl(state: string): string {
  const params = new URLSearchParams({
    clientId: process.env.CHZZK_CLIENT_ID!,
    redirectUri: getRedirectUri(),
    state,
  });
  return `https://chzzk.naver.com/account-interlock?${params}`;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

// 인가 코드 → 액세스 토큰 교환 (state 필수 — Chzzk 문서 기준)
export async function exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
  const res = await fetch(`${OPENAPI_BASE}/auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'authorization_code',
      clientId: process.env.CHZZK_CLIENT_ID,
      clientSecret: process.env.CHZZK_CLIENT_SECRET,
      code,
      state,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`토큰 교환 실패 (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Chzzk API는 { content: {...} } 래퍼를 사용하는 경우가 있음
  return data.content ?? data;
}

interface ChzzkUserInfo {
  channelId: string;
  channelName: string;
}

// 액세스 토큰으로 로그인 유저 정보 조회
export async function getChzzkUserInfo(accessToken: string): Promise<ChzzkUserInfo> {
  const res = await fetch(`${OPENAPI_BASE}/open/v1/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`유저 정보 조회 실패 (${res.status})`);
  }
  const data = await res.json();
  // Chzzk API는 { content: {...} } 래퍼를 사용하거나 직접 반환할 수 있음
  const user = data.content ?? data;
  return { channelId: user.channelId, channelName: user.channelName };
}
