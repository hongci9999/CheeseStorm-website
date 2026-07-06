// 모의 밴픽 UI 공통 스타일 — 사이트 디자인 토큰(styles/tokens) 재사용으로 일관성 유지.
import type { CSSProperties } from 'react';
import type { Team, Series, Player } from '@/lib/draft/types';

// 팀 색: 블루=heroic blue, 레드=loss red (사이트 토큰).
export const teamColor = (team: Team): string =>
  team === 'blue' ? 'var(--cheese-blue)' : 'var(--loss)';

// 팀장 = 각 팀 첫 번째 로스터 플레이어.
export const teamCaptain = (series: Series, team: Team): Player | undefined =>
  (team === 'blue' ? series.blue : series.red)[0];

// 팀 이름: 팀장 이름(있으면), 없으면 블루/레드 폴백.
export const teamLabel = (series: Series, team: Team): string =>
  teamCaptain(series, team)?.name ?? (team === 'blue' ? '블루' : '레드');

// 카드형 섹션 컨테이너.
export const card: CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-line)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-sm)',
  padding: 'var(--sp-4)',
};

// 주요 액션 버튼(시작·확정) — 시그니처 그린.
export const primaryBtn: CSSProperties = {
  height: 'var(--control-md)',
  padding: '0 var(--sp-4)',
  borderRadius: 'var(--r-sm)',
  border: 'none',
  background: 'var(--cheese-green)',
  color: 'var(--text-on-green)',
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)',
};

// 보조 버튼(빠른 시작·되돌리기·초기화 등).
export const secondaryBtn: CSSProperties = {
  height: 'var(--control-md)',
  padding: '0 var(--sp-4)',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border-line)',
  background: 'var(--surface-input)',
  color: 'var(--text-body)',
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
};

// select·input 등 폼 필드.
export const field: CSSProperties = {
  height: 'var(--control-md)',
  padding: '0 var(--sp-3)',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border-line)',
  background: 'var(--surface-input)',
  color: 'var(--text-high)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-sm)',
  outline: 'none',
};

// 섹션 소제목.
export const sectionTitle: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  fontSize: 'var(--fs-sm)',
  color: 'var(--text-high)',
  letterSpacing: 'var(--ls-normal)',
};

// 페이지 제목.
export const pageTitle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--fs-xl)',
  color: 'var(--text-high)',
  letterSpacing: 'var(--ls-tight)',
};

// 선택(하이라이트) 표시 — 시그니처 그린 아웃라인.
export const selectedOutline = '2px solid var(--cheese-green)';
export const selectedBg = 'color-mix(in srgb, var(--cheese-green) 14%, transparent)';
