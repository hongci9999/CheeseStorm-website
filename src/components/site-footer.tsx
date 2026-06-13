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

        {/* 우측: 저작권 + 서비스 설명 */}
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
