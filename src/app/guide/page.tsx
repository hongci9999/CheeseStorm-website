import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사용방법 | CHEESESTORM',
};

// ── 스크린샷 프레임 ───────────────────────────────────────────────
function ScreenshotFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{
      marginTop: 'var(--sp-5)',
      maxWidth: '50%',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      border: '1px solid var(--border-line)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    }}>
      {/* 가짜 브라우저 탭 바 */}
      <div style={{
        height: 32, background: 'var(--surface-raise)',
        borderBottom: '1px solid var(--border-line)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
      }}>
        {['#e74c3c', '#f1c40f', '#2ecc71'].map(c => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
        ))}
        <span style={{
          marginLeft: 8, flex: 1, height: 18, borderRadius: 'var(--r-xs)',
          background: 'var(--surface-card)', border: '1px solid var(--border-faint)',
          display: 'flex', alignItems: 'center', paddingLeft: 8,
          fontFamily: 'var(--font-numeral)', fontSize: 10, color: 'var(--text-faint)',
          letterSpacing: '0.04em',
        }}>
          cheesestorm.vercel.app{src.replace('/screenshots', '').replace('.png', '')}
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={900}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        priority
      />
    </div>
  );
}

// ── 공통 카드 스타일 헬퍼 ─────────────────────────────────────────
function SectionCard({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={{
      borderRadius: 'var(--r-lg)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-line)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {accent && (
        <div style={{ height: 3, background: accent }} />
      )}
      <div style={{ padding: 'var(--sp-6) var(--sp-7)' }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
      <span style={{
        fontSize: 26, width: 42, height: 42, display: 'flex', alignItems: 'center',
        justifyContent: 'center', borderRadius: 'var(--r-md)',
        background: 'var(--surface-raise)',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <div>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-xl)',
          color: 'var(--text-strong)', lineHeight: 1.1,
        }}>
          {title}
        </h2>
        {sub && (
          <span style={{
            fontFamily: 'var(--font-numeral)', fontSize: 11, letterSpacing: '0.1em',
            color: 'var(--text-faint)', textTransform: 'uppercase',
          }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
      <span style={{
        flexShrink: 0,
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--cheese-green)',
        color: 'var(--text-on-green)',
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {num}
      </span>
      <div>
        <p style={{
          margin: '2px 0 4px', fontFamily: 'var(--font-ui)', fontWeight: 700,
          fontSize: 14.5, color: 'var(--text-strong)',
        }}>
          {title}
        </p>
        <p style={{
          margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5,
          color: 'var(--text-muted)', lineHeight: 1.65,
        }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

function TabPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 28,
      padding: '0 12px', borderRadius: 'var(--r-pill)',
      border: `1px solid ${active ? 'var(--cheese-green)' : 'var(--border-line)'}`,
      background: active ? 'color-mix(in srgb, var(--cheese-green) 15%, transparent)' : 'var(--surface-raise)',
      color: active ? 'var(--cheese-green)' : 'var(--text-muted)',
      fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5,
    }}>
      {label}
    </span>
  );
}

function RoleBadge({ role, color }: { role: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 24,
      padding: '0 10px', borderRadius: 'var(--r-pill)',
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      color: color,
      fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {role}
    </span>
  );
}


export default function GuidePage() {
  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ padding: 'var(--sp-7) 0 var(--sp-6)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-3xl)',
          color: 'var(--text-strong)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0,
        }}>
          사용방법
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          HOW TO USE
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* ── 소개 ───────────────────────────────────────────────── */}
        <SectionCard accent="var(--cheese-green)">
          <SectionTitle icon="🧀" title="치즈스톰이란?" />
          <p style={{
            margin: 0, fontFamily: 'var(--font-ui)', fontSize: 14.5,
            color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 700,
          }}>
            치지직 스트리머들의 <strong style={{ color: 'var(--text-high)' }}>히어로즈 오브 더 스톰(HotS) 내전</strong> 결과를
            기록하고 티어리스트를 확인할 수 있는 웹사이트입니다.<br />
            언젠가 돌아올 히오스 대회를 대비해 내전 전적을 추적하고, 팀 구성 시 참고 자료로 활용합니다.<br />
            이 사이트에 등록된 스트리머는 스트리머 권한을 얻으며 다른 스트리머를 등록하고 경기를 기록하는 등의 권한을 얻습니다.
          </p>

          <div style={{
            display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-5)',
          }}>
            {[
              { href: '/', label: '티어리스트', en: 'TIER LIST' },
              { href: '/matches', label: '내전기록실', en: 'MATCH ROOM' },
              { href: '/streamers', label: '스트리머', en: 'ROSTER' },
            ].map(({ href, label, en }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'inline-flex', flexDirection: 'column', gap: 2,
                  padding: '10px 20px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border-line)',
                  background: 'var(--surface-raise)',
                  textDecoration: 'none',
                  transition: 'border-color var(--dur-fast)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-faint)' }}>
                  {en}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* ── 로그인 & 권한 ──────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon="🔐" title="로그인 & 권한" sub="AUTH · CHZZK OAUTH" />

          <p style={{
            margin: '0 0 var(--sp-5)', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            치지직 계정으로 로그인합니다. 권한은 계정에 따라 자동으로 부여됩니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {[
              {
                role: '일반 시청자',
                color: 'var(--text-muted)',
                desc: '로그인 없이 티어리스트, 내전기록실, 스트리머 프로필을 모두 볼 수 있습니다.',
              },
              {
                role: '스트리머',
                color: 'var(--cheese-green)',
                desc: '웹사이트에 등록된 스트리머 계정으로 로그인하면 자동 부여됩니다. 스트리머 추가·수정, 경기 입력·수정·삭제, 큐레이션 티어 편집이 가능합니다.',
              },
              {
                role: '운영자',
                color: 'var(--tier-s)',
                desc: '스트리머의 모든 권한에 더해 스트리머 삭제 권한을 가집니다. 운영자 권한은 개발자를 통해서만 추가 가능합니다',
              },
            ].map(({ role, color, desc }) => (
              <div
                key={role}
                style={{
                  display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--r-md)', background: 'var(--surface-raise)',
                  border: '1px solid var(--border-faint)',
                }}
              >
                <RoleBadge role={role} color={color} />
                <p style={{
                  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5,
                  color: 'var(--text-muted)', lineHeight: 1.65, paddingTop: 2,
                }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>

          {/* 닉네임 시각 효과 미리보기 */}
          <div style={{
            marginTop: 'var(--sp-5)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-faint)',
            background: 'var(--surface-raise)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: 'var(--sp-2) var(--sp-4)',
              borderBottom: '1px solid var(--border-faint)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-numeral)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                헤더 닉네임 미리보기
              </span>
            </div>
            <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {/* 일반 시청자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span style={{ width: 60, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>시청자</span>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 13,
                  color: 'var(--text-muted)', fontWeight: 400,
                }}>
                  홍길동
                </span>
              </div>
              {/* 스트리머 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span style={{ width: 60, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>스트리머</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--accent)' }}>
                  홍길동
                </span>
              </div>
              {/* 운영자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span style={{ width: 60, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>운영자</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#facc15' }}>
                  홍길동
                </span>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 'var(--sp-4)', padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--r-md)',
            border: '1px solid color-mix(in srgb, var(--cheese-green) 30%, var(--border-line))',
            background: 'color-mix(in srgb, var(--cheese-green) 8%, var(--surface-card))',
          }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              헤더 우측의 <strong style={{ color: 'var(--cheese-green)' }}>스트리머 로그인</strong> 버튼을 누르면 치지직 OAuth 인증 페이지로 이동합니다.
              인증 완료 후 자동으로 돌아옵니다.
            </p>
          </div>
        </SectionCard>

        {/* ── 티어리스트 ─────────────────────────────────────────── */}
        <SectionCard accent="var(--tier-s)">
          <SectionTitle icon="🏆" title="티어리스트" sub="TIER LIST · /" />

          <p style={{
            margin: '0 0 var(--sp-5)', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            메인 페이지입니다. 상단 탭으로 세 가지 뷰를 전환할 수 있습니다.
          </p>

          <ScreenshotFrame src="/screenshots/home.png" alt="티어리스트 화면" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', marginTop: 'var(--sp-6)' }}>
            {/* 스트리머 자동 탭 */}
            <div style={{
              borderRadius: 'var(--r-md)', background: 'var(--surface-raise)',
              border: '1px solid var(--border-faint)', padding: 'var(--sp-4) var(--sp-5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <TabPill label="스트리머 자동" active />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)' }}>
                  참고용 자동 티어
                </span>
              </div>
              <p style={{
                margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5,
                color: 'var(--text-muted)', lineHeight: 1.65,
              }}>
                승률과 스탯을 종합해 <strong style={{ color: 'var(--text-high)' }}>자동으로 계산</strong>된 티어입니다.
                내전은 팀이 의도적으로 밸런싱되므로 실력 지표보다는 <strong style={{ color: 'var(--text-high)' }}>전적 요약</strong>으로만
                참고하세요. <br />
                역할군 필터(탱커·투사·원거리 암살자 등)로 포지션별로 볼 수 있습니다.
              </p>
              
            </div>

            {/* 스트리머 티어표 탭 */}
            <div style={{
              borderRadius: 'var(--r-md)', background: 'var(--surface-raise)',
              border: '1px solid var(--border-faint)', padding: 'var(--sp-4) var(--sp-5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <TabPill label="스트리머 티어표" active />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)' }}>
                  팀 편성 시 실제 참고 지표
                </span>
              </div>
              <p style={{
                margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5,
                color: 'var(--text-muted)', lineHeight: 1.65,
              }}>
                운영자 또는 권한 있는 스트리머가 <strong style={{ color: 'var(--text-high)' }}>직접 드래그&드롭</strong>으로 배정하는 티어표입니다.
                권한이 있는 모든 사용자가 참여할 수 있고 하나의 티어표가 모든 사용자에게 보여집니다.<br />
                로그인 후 권한이 있으면 카드를 드래그해 티어를 변경할 수 있습니다.
              </p>
            </div>

            {/* 영웅 탭 */}
            <div style={{
              borderRadius: 'var(--r-md)', background: 'var(--surface-raise)',
              border: '1px solid var(--border-faint)', padding: 'var(--sp-4) var(--sp-5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <TabPill label="영웅" active />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-faint)' }}>
                  영웅별 승률 통계
                </span>
              </div>
              <p style={{
                margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13.5,
                color: 'var(--text-muted)', lineHeight: 1.65,
              }}>
                내전에서 선택된 영웅들의 <strong style={{ color: 'var(--text-high)' }}>승률과 픽 수</strong>를 티어 형태로 확인합니다.
              </p>
            </div>
          </div>

          
        </SectionCard>

        {/* ── 내전기록실 ─────────────────────────────────────────── */}
        <SectionCard accent="var(--tier-a)">
          <SectionTitle icon="📋" title="내전기록실" sub="MATCH ROOM · /matches" />

          <p style={{
            margin: '0 0 var(--sp-5)', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            진행된 모든 내전 결과를 날짜별로 확인할 수 있습니다.
          </p>

          <ScreenshotFrame src="/screenshots/matches.png" alt="내전기록실 화면" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Step
              num={1}
              title="경기 목록 확인"
              desc="날짜별로 그룹화된 경기 목록이 표시됩니다. 각 경기에서 양 팀의 선수, 영웅, 맵, 경기 시간을 한눈에 확인할 수 있습니다."
            />
            <Step
              num={2}
              title="검색 및 필터"
              desc="상단 검색창에 선수 이름, 영웅 이름, 맵 이름을 입력하면 해당 경기만 필터링됩니다."
            />
            <Step
              num={3}
              title="경기 상세 보기"
              desc="경기 카드를 클릭하면 KDA, 경험치, 딜량, 힐량 등 세부 스탯을 확인할 수 있습니다."
            />
            <Step
              num={4}
              title="경기 등록 (권한 필요)"
              desc={
                <>
                  우측 상단 <strong style={{ color: 'var(--cheese-green)' }}>+ 경기 입력</strong> 버튼으로
                  새 경기를 등록합니다. 치지직에 등록된 스트리머로 로그인해야 합니다.
                </>
              }
            />
          </div>
        </SectionCard>

        {/* ── 경기 입력 ──────────────────────────────────────────── */}
        <SectionCard accent="var(--cheese-green)">
          <SectionTitle icon="✏️" title="경기 입력" sub="MATCH ROOM · /matches/new" />

          <p style={{
            margin: '0 0 var(--sp-5)', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            내전 결과를 등록하는 페이지입니다. <strong style={{ color: 'var(--cheese-green)' }}>스트리머 권한</strong> 이상이 필요합니다.
          </p>

          <ScreenshotFrame src="/screenshots/matches-new.png" alt="경기 입력 화면" />

          {/* AI OCR 하이라이트 */}
          <div style={{
            marginTop: 'var(--sp-6)',
            borderRadius: 'var(--r-lg)',
            border: '1px solid color-mix(in srgb, var(--cheese-green) 35%, var(--border-line))',
            background: 'color-mix(in srgb, var(--cheese-green) 6%, var(--surface-card))',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: 'var(--sp-4) var(--sp-5)',
              borderBottom: '1px solid color-mix(in srgb, var(--cheese-green) 20%, var(--border-faint))',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
            }}>
              <span style={{ fontSize: 22 }}>🤖</span>
              <div>
                <p style={{
                  margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 15, color: 'var(--cheese-green)',
                }}>
                  AI가 결과창을 자동으로 분석합니다
                </p>
                <p style={{
                  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12,
                  color: 'var(--text-faint)', marginTop: 2,
                }}>
                  Powered by Gemini AI
                </p>
              </div>
            </div>
            <div style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
              <p style={{
                margin: '0 0 var(--sp-3)', fontFamily: 'var(--font-ui)', fontSize: 13.5,
                color: 'var(--text-muted)', lineHeight: 1.7,
              }}>
                게임 종료 후 <strong style={{ color: 'var(--text-high)' }}>통계 탭</strong>이 열린 결과 화면을 캡처해 업로드하면,
                Gemini AI가 선수 이름·영웅·KDA·딜량·힐량·경험치 등 모든 스탯을 자동으로 읽어옵니다.
                아래와 같은 화면이면 됩니다.
              </p>
              {/* 예시 스크린샷 */}
              <div style={{
                marginTop: 'var(--sp-3)',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-line)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                maxWidth: 560,
              }}>
                <div style={{
                  background: 'var(--surface-raise)',
                  borderBottom: '1px solid var(--border-line)',
                  padding: '6px 10px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-ui)', color: 'var(--text-faint)' }}>
                    게임 종료 화면 → 통계 탭 캡처
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-numeral)',
                    letterSpacing: '0.08em', color: 'var(--cheese-green)',
                    padding: '2px 8px', borderRadius: 'var(--r-pill)',
                    border: '1px solid color-mix(in srgb, var(--cheese-green) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--cheese-green) 12%, transparent)',
                  }}>
                    AI 인식 가능
                  </span>
                </div>
                <Image
                  src="/screenshots/hots-result.png"
                  alt="히오스 게임 결과 화면 예시 — 통계 탭"
                  width={1456}
                  height={816}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
              <p style={{
                margin: 'var(--sp-3) 0 0', fontFamily: 'var(--font-ui)', fontSize: 12.5,
                color: 'var(--text-faint)', lineHeight: 1.6,
              }}>
                인식이 잘못된 항목은 업로드 후 직접 수정할 수 있습니다.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <Step
              num={1}
              title="스크린샷 업로드 (OCR 자동 파싱)"
              desc="게임 종료 후 통계 탭이 열린 결과 화면을 캡처해 업로드합니다. Gemini AI가 선수 이름, 영웅, 스탯을 자동으로 인식합니다."
            />
            <Step
              num={2}
              title="팀 슬롯 확인 및 수정"
              desc="파싱된 데이터를 확인하고 잘못 인식된 선수/영웅 이름을 수정합니다. 각 슬롯에서 스트리머를 드롭다운으로 선택할 수 있습니다."
            />
            <Step
              num={3}
              title="경기 정보 입력"
              desc="맵, 경기 시간, 승팀(블루/레드)을 선택합니다. 날짜는 오늘로 자동 설정됩니다."
            />
            <Step
              num={4}
              title="저장"
              desc="저장 버튼을 누르면 내전기록실에 바로 반영됩니다. 중복 경기가 감지되면 경고 후 확인을 요청합니다."
            />
          </div>
        </SectionCard>

        {/* ── 스트리머 ───────────────────────────────────────────── */}
        <SectionCard accent="var(--tier-b)">
          <SectionTitle icon="👥" title="스트리머" sub="ROSTER · /streamers" />

          <p style={{
            margin: '0 0 var(--sp-5)', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            내전에 참여하는 스트리머 목록입니다. 아바타를 클릭하면 개인 전적 프로필 페이지로 이동합니다.
          </p>

          <ScreenshotFrame src="/screenshots/streamers.png" alt="스트리머 목록 화면" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <Step
              num={1}
              title="개인 프로필 확인"
              desc="스트리머 카드를 클릭하면 역할군별 플레이 분포, 주요 영웅 풀, 승률, KDA, 그 외 다양한 정보를 볼 수 있습니다."
            />
          </div>

          <ScreenshotFrame src="/screenshots/streamer-profile.png" alt="스트리머 프로필 화면" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <Step
              num={2}
              title="스트리머 추가·수정 (스트리머 이상) / 삭제 (운영자 전용)"
              desc="스트리머 이상 권한으로 로그인하면 스트리머 추가 양식과 게임 이름 수정 버튼이 나타납니다. 스트리머 삭제는 운영자만 가능합니다."
            />
          </div>
        </SectionCard>

        <div style={{ height: 'var(--sp-10)' }} />
      </div>
    </div>
  );
}
