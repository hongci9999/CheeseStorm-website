'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CANONICAL_HEROES, heroImageUrl } from '@/lib/hero-image';
import { roleOfHero } from '@/lib/heroes';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['탱커', '투사', '암살자', '지원가', '전문가'];

interface Props {
  available: string[];              // 선택 가능한 영웅(잠긴 영웅 제외됨)
  onPick: (hero: string) => void;
}

export function HeroGrid({ available, onPick }: Props) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const availableSet = new Set(available);

  const shown = CANONICAL_HEROES.filter((h) => {
    if (role !== 'all' && roleOfHero(h) !== role) return false;
    if (q && !h.includes(q.trim())) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setRole('all')} style={{ fontWeight: role === 'all' ? 700 : 400 }}>전체</button>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ fontWeight: role === r ? 700 : 400 }}>{r}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="영웅 검색" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
        {shown.map((h) => {
          const enabled = availableSet.has(h);
          const img = heroImageUrl(h);
          return (
            <button
              key={h}
              disabled={!enabled}
              onClick={() => enabled && onPick(h)}
              title={h}
              style={{ opacity: enabled ? 1 : 0.3, display: 'grid', justifyItems: 'center', gap: 2, padding: 2 }}
            >
              {img && <Image src={img} alt={h} width={48} height={48} style={{ borderRadius: 6, width: 'auto', height: 'auto' }} />}
              <span style={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center' }}>{h}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
