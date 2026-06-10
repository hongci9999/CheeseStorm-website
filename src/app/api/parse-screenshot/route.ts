import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export interface ParsedPlayer {
  name: string;
  hero: string;
  kills: number;
  assists: number;
  deaths: number;
  siegeDmg: number;
  heroDmg: number;
  healing: number;
  selfHeal: number;
  xp: number;
}

export interface ParsedMatch {
  map?: string;
  dur?: string;
  winner?: 'blue' | 'red';
  blueTeam: ParsedPlayer[];
  redTeam: ParsedPlayer[];
}

const PROMPT = `이 히어로즈 오브 더 스톰 경기 결과 스크린샷을 분석해서 다음 정보를 JSON으로 반환해.

추출할 정보:
- map: 화면 상단 제목에서 맵 이름만 (예: "저주받은 골짜기 승리" → "저주받은 골짜기")
- dur: 하단 게임시간 (예: "31:52")
- winner: 제목에 "승리"가 있으면 "blue", "패배"면 "red"
- blueTeam: 초록색으로 하이라이트된 팀(우리 팀) 플레이어 5명 (위→아래 순)
- redTeam: 나머지 팀(상대 팀) 플레이어 5명 (위→아래 순)

스탯 컬럼 순서 (왼→오): 킬, 어시, 데스, 공성딜, 영웅딜, 힐량, 자가힐, 경험치기여

각 플레이어 형식 (숫자는 콤마 제거, "-"는 0으로):
{
  "name": "영웅 아이콘 아래 작은 닉네임(배틀태그)",
  "hero": "영웅명",
  "kills": 0,
  "assists": 0,
  "deaths": 0,
  "siegeDmg": 0,
  "heroDmg": 0,
  "healing": 0,
  "selfHeal": 0,
  "xp": 0
}

JSON만 반환, 마크다운 코드블록 없이:
{"map":"...","dur":"...","winner":"blue","blueTeam":[...],"redTeam":[...]}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    { inlineData: { mimeType: file.type as 'image/png' | 'image/jpeg', data: base64 } },
    PROMPT,
  ]);

  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    const parsed: ParsedMatch = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: '파싱 실패', raw: text }, { status: 422 });
  }
}
