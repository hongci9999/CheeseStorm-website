import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { finalizeTournamentResults } from '@/lib/firestore-admin';

// 대회 종료 후 관리자가 1회 호출 — 그 시점 경기 데이터로 통계를 고정해 저장한다.
// 이후 /tournament 페이지는 재계산 없이 이 스냅샷만 읽는다(다음 대회 전까지).
export async function POST() {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.res;

  await finalizeTournamentResults();
  return NextResponse.json({ ok: true });
}
