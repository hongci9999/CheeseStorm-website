'use client';

// 세그먼트 토글 — 드래프트 종류·방식 선택 (드롭다운 대체).
export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 3, background: 'var(--surface-input)',
      border: '1px solid var(--border-line)', borderRadius: 'var(--r-pill)' }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            padding: '6px 16px', border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontWeight: on ? 800 : 600, fontSize: 'var(--fs-sm)',
            color: on ? 'var(--text-on-green)' : 'var(--text-muted)',
            background: on ? 'var(--cheese-green)' : 'transparent',
            transition: 'background var(--dur-fast) var(--ease-out)',
          }}>{label}</button>
        );
      })}
    </div>
  );
}
