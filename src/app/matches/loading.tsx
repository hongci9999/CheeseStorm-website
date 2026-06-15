// 경기기록 페이지 로딩 스켈레톤 — page.tsx 서버 실행 중 즉시 표시
const SKEL: React.CSSProperties = {
  borderRadius: 'var(--r-sm)',
  background: 'var(--surface-raise)',
  animation: 'skel-pulse 1.5s ease-in-out infinite',
};

function MatchCardSkeleton() {
  return (
    <div style={{
      borderRadius: 'var(--r-lg)', background: 'var(--surface-card)',
      border: '1px solid var(--border-line)', boxShadow: 'var(--shadow-sm)',
      padding: '0 var(--sp-4)', height: 68,
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
    }}>
      {/* 번호 */}
      <div style={{ ...SKEL, width: 28, height: 13 }} />
      {/* 영웅 스택 VS 영웅 스택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ ...SKEL, width: 24, height: 24, borderRadius: '50%' }} />)}
        <div style={{ ...SKEL, width: 28, height: 16, marginInline: 4 }} />
        {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ ...SKEL, width: 24, height: 24, borderRadius: '50%' }} />)}
      </div>
      {/* 맵 이름 */}
      <div style={{ ...SKEL, flex: 1, height: 14, maxWidth: 160 }} />
      {/* 날짜 */}
      <div style={{ ...SKEL, width: 44, height: 12 }} />
    </div>
  );
}

export default function MatchesLoading() {
  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <div style={{ ...SKEL, width: 160, height: 36, borderRadius: 'var(--r-sm)' }} />
        <div style={{ ...SKEL, width: 200, height: 14, marginTop: 10 }} />
      </div>

      {/* 검색창 */}
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <div style={{ ...SKEL, width: 260, height: 40 }} />
      </div>

      {/* 타임라인 */}
      <div style={{ position: 'relative', paddingLeft: 'var(--sp-6)' }}>
        <span style={{ position: 'absolute', left: 7, top: 8, bottom: 8,
          width: 2, background: 'var(--border-line)' }} />

        {[3, 2, 4].map((count, gi) => (
          <div key={gi} style={{ marginBottom: 'var(--sp-6)' }}>
            {/* 날짜 노드 */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
              gap: 10, marginBottom: 'var(--sp-4)' }}>
              <span style={{
                position: 'absolute', left: -23,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--surface-raise)',
                border: '3px solid var(--bg-app)',
              }} />
              <div style={{ ...SKEL, width: 90, height: 14 }} />
              <div style={{ ...SKEL, width: 36, height: 12 }} />
            </div>

            {/* 매치 카드들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {Array.from({ length: count }).map((_, i) => <MatchCardSkeleton key={i} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
