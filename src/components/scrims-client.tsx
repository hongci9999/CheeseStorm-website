'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteScrim, mergeScrimsIntoSeries } from '@/lib/api-client';
import { ScrimCard, scrimDateLabel } from '@/components/scrim-card';
import ScrimDashboard from '@/components/scrim-dashboard';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { assignScrimNumbers, type Scrim } from '@/lib/scrim';

type Tab = 'dashboard' | 'draft';

// 같은 세트 경기는 목록에서 항상 붙어 있으므로 연속 구간만 묶으면 된다.
// seriesId 없는 경기는 각자 단독 그룹.
function groupBySeries(scrims: Scrim[]): Scrim[][] {
  const out: Scrim[][] = [];
  for (const s of scrims) {
    const last = out[out.length - 1];
    if (last && s.seriesId && last[0].seriesId === s.seriesId) last.push(s);
    else out.push([s]);
  }
  return out;
}

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

  // 하드 피어리스 세트 단위 번호 — 세트도, 세트 내 경기도 오래된 순.
  const numberById = assignScrimNumbers(scrims);

  // 과거 기록 등 seriesId 없는 경기들을 수동으로 세트 묶는 모드.
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  function toggleMergeMode() {
    setMergeMode((v) => !v);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleMerge() {
    if (selected.size < 2 || merging) return;
    setMerging(true);
    try {
      await mergeScrimsIntoSeries([...selected]);
      setMergeMode(false);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '세트 묶기 실패');
    } finally {
      setMerging(false);
    }
  }

  async function handleDelete(s: Scrim) {
    if (!confirm(`${scrimDateLabel(s.date)} ${s.map} 밴픽 기록을 삭제할까요?`)) return;
    try {
      await deleteScrim(s.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  // 스크림 대시보드는 넓은 표 위주 — 모바일은 PC 안내만 노출
  if (bp === 'mobile') {
    return (
      <main style={{ padding: 'var(--sp-5)', display: 'grid', gap: 'var(--sp-3)',
        placeContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-xl)', color: 'var(--text-high)' }}>스크림</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)',
          color: 'var(--text-faint)', lineHeight: 1.6 }}>
          스크림 통계는 넓은 표가 많아 PC 화면에서만 제공됩니다.
        </p>
      </main>
    );
  }

  return (
    // 대시보드 탭은 좌우 제한 없음 — 밴픽 탭 내용만 좁게 중앙 정렬
    <main style={{ padding: 'var(--sp-5)', display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'var(--fs-xl)', color: 'var(--text-high)', letterSpacing: 'var(--ls-tight)' }}>
          스크림
        </h1>

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

      {/* 안내문 — 메인 페이지 EloNotice와 동일 스타일(초록), 탭 위 */}
      <div style={{
        borderRadius: 'var(--r-md)',
        border: '1px solid color-mix(in srgb, var(--cheese-green) 55%, var(--border-line))',
        background: 'color-mix(in srgb, var(--cheese-green) 14%, var(--surface-card))',
        padding: 'var(--sp-3) var(--sp-4)',
      }}>
        <p style={{
          margin: 0, fontSize: 13, fontFamily: 'var(--font-ui)',
          color: 'var(--cheese-green)', fontWeight: 600, lineHeight: 1.55,
        }}>
          히오스 전프로 KyoCha님의 방송에서 진행한 스크림 내역을 바탕으로 만들어진 통계입니다.
        </p>
      </div>

      {/* 탭 — 메인 페이지 상위 탭 바와 동일한 하단 강조선 스타일 */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--border-line)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{
                position: 'relative',
                height: 44, padding: '0 20px',
                flexShrink: 0, whiteSpace: 'nowrap',
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 500,
                fontSize: 14,
                color: active ? 'var(--text-strong)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color var(--dur-fast) var(--ease-out)',
                // 선택 탭 하단 강조선 — overflowX:auto 컨테이너라 inset 그림자 사용 (page.tsx와 동일)
                boxShadow: active ? 'inset 0 -2px 0 var(--cheese-green)' : 'none',
              }}>
              {label}
            </button>
          );
        })}
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

          {groupBySeries(scrims).map((group) => {
            const cards = group.map((s) => (
              <ScrimCard key={s.id} scrim={s} no={numberById.get(s.id)} S={S}
                canEdit={isStreamer} onDelete={() => handleDelete(s)}
                selectMode={mergeMode} selected={selected.has(s.id)} onToggleSelect={() => toggleSelect(s.id)} />
            ));
            if (group.length === 1) return cards[0];
            const no = numberById.get(group[0].id);
            return (
              <section key={group[0].id} style={{
                display: 'grid', gap: 'var(--sp-3)', padding: 'var(--sp-3)',
                borderRadius: 'var(--r-lg)',
                border: '1px solid color-mix(in srgb, var(--cheese-green) 55%, var(--border-line))',
                background: 'color-mix(in srgb, var(--cheese-green) 8%, var(--surface-raise))' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)' }}>
                  {scrimDateLabel(group[0].date)}{no ? ` · ${no.dateSetNo}번째 시리즈` : ''} · {group.length}세트
                </span>
                {cards}
              </section>
            );
          })}
        </div>
      )}

      {/* 과거 기록 등 세트 수동 묶기 — 운영자·권한 스트리머만. 스크롤해도 항상 보이는 우측 하단 플로팅. */}
      {isStreamer && tab === 'draft' && scrims.length > 1 && (
        <div style={{
          position: 'fixed', right: 'var(--sp-4)', bottom: 'var(--sp-4)', zIndex: 40,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: 6, borderRadius: 'var(--r-pill)',
          background: 'var(--surface-card)', border: '1px solid var(--border-line)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {mergeMode && (
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-faint)', padding: '0 4px' }}>
              {selected.size}개 선택
            </span>
          )}
          {mergeMode && (
            <button onClick={handleMerge} disabled={selected.size < 2 || merging} style={{
              height: 28, padding: '0 10px', borderRadius: 'var(--r-pill)', border: 'none',
              background: 'var(--cheese-green)', color: 'var(--text-on-green)',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 11,
              opacity: selected.size < 2 || merging ? 0.5 : 1,
              cursor: selected.size < 2 || merging ? 'not-allowed' : 'pointer' }}>
              {merging ? '묶는 중…' : '묶기 확인'}
            </button>
          )}
          <button onClick={toggleMergeMode} style={{
            height: 28, padding: '0 10px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            border: `1px solid ${mergeMode ? 'var(--loss)' : 'var(--border-line)'}`,
            background: mergeMode ? 'transparent' : 'var(--surface-raise)',
            color: mergeMode ? 'var(--loss)' : 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 11 }}>
            {mergeMode ? '취소' : '경기 묶기'}
          </button>
        </div>
      )}
    </main>
  );
}
