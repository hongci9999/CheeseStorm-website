import Image from 'next/image';

// 사이트 하단 푸터 — 서버 컴포넌트 (CSS 변수 기반이라 테마 자동 지원)
export default function SiteFooter() {
  return (
    <footer style={{
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-line)',
    }}>
      <div style={{
        maxWidth: 'var(--container)',
        margin: '0 auto',
        padding: '24px var(--sp-6)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--sp-6)',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {/* 좌측: 브랜드 + 설명 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/assets/logo-emblem.png" alt="CHEESESTORM" width={24} height={24} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
            }}>
              CHEESE<span style={{ color: 'var(--accent)' }}>STORM</span>
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            color: 'var(--text-faint)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            치지직 HotS 내전 커뮤니티
          </p>
          <a
            href="https://www.linkedin.com/in/ingee-hong99"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              color: 'var(--text-faint)',
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </a>
        </div>

        {/* 우측: 저작권 + 피드백 링크 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          textAlign: 'right',
        }}>
          <span style={{
            fontFamily: 'var(--font-numeral)',
            fontSize: 12,
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            © 2025 Cheesestorm
          </span>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
          }}>
            치지직 스트리머들의 HotS 내전 전적 기록 서비스
          </span>
          <a
            href="https://github.com/hongci9999/CheeseStorm-website/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 5,
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              color: 'var(--text-faint)',
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            버그 / 이슈 등록
          </a>
        </div>
      </div>

      {/* 면책 문구 */}
      <div style={{
        borderTop: '1px solid var(--border-faint)',
        padding: '10px var(--sp-6)',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          color: 'var(--text-faint)',
          lineHeight: 1.6,
        }}>
          본 사이트는 비상업적 팬 제작 사이트로, Blizzard Entertainment 및 치지직(CHZZK)과 무관합니다.
          Heroes of the Storm은 Blizzard Entertainment의 상표입니다.
        </p>
      </div>
    </footer>
  );
}
