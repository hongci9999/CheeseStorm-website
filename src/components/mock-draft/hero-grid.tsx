'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CANONICAL_HEROES, heroImageUrl } from '@/lib/hero-image';
import { roleOfHero } from '@/lib/heroes';
import type { Role } from '@/lib/types';
import { field, selectedOutline, selectedBg } from './ui';

const ROLES: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

// 역할 필터 탭 버튼 스타일.
const tabStyle = (active: boolean) => ({
  height: 'var(--control-sm)',
  padding: '0 var(--sp-3)',
  borderRadius: 'var(--r-pill)',
  border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
  background: active ? selectedBg : 'transparent',
  color: active ? 'var(--text-high)' : 'var(--text-muted)',
  fontFamily: 'var(--font-ui)',
  fontWeight: active ? 700 : 500,
  fontSize: 'var(--fs-xs)',
  cursor: 'pointer',
  transition: 'border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
} as const);

interface Props {
  available: string[];              // 선택 가능한 영웅(잠긴 영웅 제외됨)
  selected: string;                 // 현재 선택(하이라이트)된 영웅. 확정 전 임시 선택.
  onSelect: (hero: string) => void; // 영웅 초상화 클릭 → 선택(확정은 별도 버튼)
}

export function HeroGrid({ available, selected, onSelect }: Props) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const availableSet = new Set(available);

  const shown = CANONICAL_HEROES.filter((h) => {
    if (role !== 'all' && roleOfHero(h) !== role) return false;
    if (q && !h.includes(q.trim())) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...field, height: 'var(--control-sm)', width: 140 }}
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="영웅 검색" />
        <button onClick={() => setRole('all')} style={{ ...tabStyle(role === 'all'), marginLeft: 'auto' }}>전체</button>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} style={tabStyle(role === r)}>{r}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
        gridAutoRows: 'max-content', alignContent: 'start', gap: 6,
        height: 440, overflowY: 'auto', padding: 4 }}>
        {shown.map((h) => {
          const enabled = availableSet.has(h);
          const isSelected = h === selected;
          const img = heroImageUrl(h);
          return (
            <button
              key={h}
              disabled={!enabled}
              onClick={() => enabled && onSelect(h)}
              title={h}
              style={{
                opacity: enabled ? 1 : 0.28,
                display: 'grid',
                justifyItems: 'center',
                gap: 3,
                padding: 3,
                border: '1px solid transparent',
                outline: isSelected ? selectedOutline : 'none',
                outlineOffset: isSelected ? 1 : 0,
                borderRadius: 'var(--r-md)',
                background: isSelected ? selectedBg : 'transparent',
                cursor: enabled ? 'pointer' : 'default',
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
            >
              {img && <Image src={img} alt={h} width={48} height={48} style={{ borderRadius: 'var(--r-sm)', width: 'auto', height: 'auto' }} />}
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-3xs)', lineHeight: 1.1, textAlign: 'center',
                color: isSelected ? 'var(--text-high)' : 'var(--text-muted)' }}>{h}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
