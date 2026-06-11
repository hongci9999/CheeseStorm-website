import { beforeEach, describe, expect, it, vi } from 'vitest';

// Gemini SDK 목 — 실제 API 호출 없이 라우트의 에러 처리만 검증한다
const generateContentMock = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  },
}));

import { POST } from '../route';

function makeRequest(): Request {
  const formData = new FormData();
  const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
  formData.append('image', png, 'screenshot.png');
  return new Request('http://localhost/api/parse-screenshot', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/parse-screenshot', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  it('Gemini 호출 실패 시(예: 모델 retire로 404) 502와 에러 메시지를 반환한다', async () => {
    generateContentMock.mockRejectedValue(
      new Error('[404 Not Found] models/gemini-1.5-flash is not found'),
    );

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('정상 응답이면 파싱된 JSON을 반환한다', async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          '{"map":"저주받은 골짜기","dur":"31:52","winner":"blue","blueTeam":[],"redTeam":[]}',
      },
    });

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map).toBe('저주받은 골짜기');
    expect(body.winner).toBe('blue');
  });
});
