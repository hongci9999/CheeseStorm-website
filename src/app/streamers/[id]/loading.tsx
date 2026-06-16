// 스트리머 프로필 페이지 로딩 스켈레톤 — page.tsx 서버 실행 중 즉시 표시
const SKEL: React.CSSProperties = {
  borderRadius: 'var(--r-sm)',
  background: 'var(--surface-raise)',
  animation: 'skel-pulse 1.5s ease-in-out infinite',
};

export default function ProfileLoading() {
  return (
    <>
      <style>{`
        .skel-layout {
          display: grid;
          grid-template-columns: 310px 1fr;
          gap: var(--sp-5);
          align-items: start;
          padding: var(--sp-7) 0 var(--sp-20);
        }
        @media (max-width: 1023px) {
          .skel-layout {
            display: flex;
            flex-direction: column;
            padding: var(--sp-5) 0 var(--sp-20);
          }
        }
      `}</style>
      <div className="skel-layout">

        {/* ── 사이드바 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

          {/* 프로필 아이덴티티 카드 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-6)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)',
          }}>
            <div style={{ position: 'relative', width: 104, height: 104 }}>
              <div style={{ ...SKEL, width: '100%', height: '100%', borderRadius: '50%' }} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '3px solid color-mix(in srgb, var(--hots-purple) 30%, transparent)',
                  borderTopColor: 'var(--hots-purple)',
                  animation: 'spin 0.7s linear infinite',
                }} />
              </div>
            </div>
            <div style={{ ...SKEL, width: '55%', height: 22 }} />
            <div style={{ ...SKEL, width: '38%', height: 13 }} />
            <div style={{ ...SKEL, width: '28%', height: 20, borderRadius: 'var(--r-pill)' }} />
          </div>

          {/* 스탯 카드 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)',
          }}>
            <div style={{ ...SKEL, width: '35%', height: 32, borderRadius: 'var(--r-sm)' }} />
            <div style={{ display: 'flex', gap: 'var(--sp-6)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ ...SKEL, width: 48, height: 20 }} />
                  <div style={{ ...SKEL, width: 36, height: 10 }} />
                </div>
              ))}
            </div>
            <div style={{ ...SKEL, width: '100%', height: 8 }} />
          </div>

          {/* 포지션 카드 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
          }}>
            <div style={{ ...SKEL, width: '45%', height: 16 }} />
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{ ...SKEL, width: 46, height: 13 }} />
                <div style={{ ...SKEL, flex: 1, height: 12 }} />
                <div style={{ ...SKEL, width: 68, height: 13 }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 탭 영역 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

          {/* 탭 바 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-2)',
            display: 'flex', gap: 'var(--sp-2)',
          }}>
            {[68, 72, 96].map(w => (
              <div key={w} style={{ ...SKEL, width: w, height: 36 }} />
            ))}
          </div>

          {/* 개요 탭 — 선호 캐릭터 영역 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
          }}>
            <div style={{ ...SKEL, width: '30%', height: 18 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ ...SKEL, height: 148 }} />)}
            </div>
          </div>

          {/* 맵 카드 */}
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-line)', padding: 'var(--sp-5)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
          }}>
            <div style={{ ...SKEL, width: '25%', height: 18 }} />
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{ ...SKEL, width: 110, height: 14 }} />
                <div style={{ ...SKEL, flex: 1, height: 10 }} />
                <div style={{ ...SKEL, width: 100, height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
