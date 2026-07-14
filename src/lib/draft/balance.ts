import type { Player } from './types';

// Elo 기준 팀 밸런싱.
// 각 팀 첫 슬롯(팀장)은 고정, 나머지 8명만 재배분해 양 팀 Elo 합 차이를 최소화한다.
// 8명 중 4명을 블루로 고르는 조합은 C(8,4)=70 → 완전탐색으로 충분.
// ponytail: 브루트포스. 팀 크기가 5로 고정이라 조합 수가 상수, 최적화 불필요.
export function balanceByElo(
  blue: Player[],
  red: Player[],
  eloOf: (id: string) => number,
): { blue: Player[]; red: Player[] } {
  if (blue.length !== 5 || red.length !== 5) return { blue, red };

  const blueCaptain = blue[0];
  const redCaptain = red[0];
  const pool = [...blue.slice(1), ...red.slice(1)]; // 8명
  const elo = (p: Player) => eloOf(p.id);

  let best: { blue: Player[]; red: Player[] } | null = null;
  let bestDiff = Infinity;

  // 비트마스크로 8명 중 4명 선택 (블루행)
  for (let mask = 0; mask < 1 << 8; mask++) {
    if (countBits(mask) !== 4) continue;
    const toBlue: Player[] = [];
    const toRed: Player[] = [];
    for (let i = 0; i < 8; i++) (mask & (1 << i) ? toBlue : toRed).push(pool[i]);

    const blueSum = elo(blueCaptain) + toBlue.reduce((s, p) => s + elo(p), 0);
    const redSum = elo(redCaptain) + toRed.reduce((s, p) => s + elo(p), 0);
    const diff = Math.abs(blueSum - redSum);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = { blue: [blueCaptain, ...toBlue], red: [redCaptain, ...toRed] };
    }
  }

  return best ?? { blue, red };
}

function countBits(n: number): number {
  let c = 0;
  for (let x = n; x; x >>= 1) c += x & 1;
  return c;
}

export function teamElo(list: Player[], eloOf: (id: string) => number): number {
  return list.reduce((s, p) => s + eloOf(p.id), 0);
}
