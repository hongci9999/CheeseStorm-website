'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteScrim } from '@/lib/api-client';
import { ScrimCard, scrimDateLabel } from '@/components/scrim-card';
import ScrimDashboard from '@/components/scrim-dashboard';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type { Scrim } from '@/lib/scrim';

type Tab = 'dashboard' | 'draft';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'draft', label: '밴픽' },
];

export default function ScrimsClient({ scrims, isStreamer }: {
  scrims: Scrim[];
  isStreamer: boolean;
}) {
  const router = useRouter();
  const bp = useBreakpoint();
  const S = bp === 'mobile' ? 42 : 52; // 초상화 크기 = 간격 단위 (겹침 없음, 좁으면 가로 스크롤)
  const [tab, setTab] = useState<Tab>('dashboard');

  async function handleDelete(s: Scrim) {
    if (!confirm(`${scrimDateLabel(s.date)} ${s.map} 밴픽 기록을 삭제할까요?`)) return;
    try {
      await deleteScrim(s.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  return (
    // 대시보드 탭은 좌우 제한 없음 — 밴픽 탭 내용만 좁게 중앙 정렬
    <main style={{ padding: 'var(--sp-5)', display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-xl)', color: 'var(--text-high)', letterSpacing: 'var(--ls-tight)' }}>
          스크림
        </h1>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{ height: 'var(--control-sm)', padding: '0 var(--sp-4)',
                  borderRadius: 'var(--r-pill)',
                  border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
                  background: active ? 'color-mix(in srgb, var(--cheese-green) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--text-high)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
                  fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
        </div>

        {isStreamer && (
          <Link href="/scrims/new" style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 40, padding: '0 var(--sp-4)', borderRadius: 'var(--r-sm)',
            background: 'var(--cheese-green)', color: 'var(--text-on-green)',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13,
            textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ＋ 경기 기록
          </Link>
        )}
      </div>

      {tab === 'dashboard' ? (
        <ScrimDashboard scrims={scrims} />
      ) : (
        <div style={{ maxWidth: 760, width: '100%', margin: '0 auto',
          display: 'grid', gap: 'var(--sp-4)' }}>
          {scrims.length === 0 && (
            <p style={{ padding: 'var(--sp-8) 0', textAlign: 'center',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>
              기록된 스크림이 없습니다.
            </p>
          )}
          {scrims.map((s) => (
            <ScrimCard key={s.id} scrim={s} S={S}
              canEdit={isStreamer} onDelete={() => handleDelete(s)} />
          ))}
        </div>
      )}
    </main>
  );
}
