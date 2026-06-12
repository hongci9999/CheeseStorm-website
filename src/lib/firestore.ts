import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
export { isFirebaseConfigured };
import type { Match, Streamer } from './types';

// --- 클라이언트 세션 캐시 ---
// SPA 내비게이션마다 같은 데이터를 다시 요청하고 로딩 스피너를 띄우는 걸 막는다.
// 서버 컴포넌트에서는 요청 간 캐시가 공유되어 stale될 위험이 있으므로 클라이언트에서만 캐시.
const isClient = typeof window !== 'undefined';
let streamersCache: Streamer[] | null = null;
let matchesCache: Match[] | null = null;

// 페이지가 첫 렌더에서 동기적으로 읽어 스피너 없이 즉시 그리기 위한 getter. 없으면 null.
export function getCachedStreamers(): Streamer[] | null {
  return streamersCache;
}
export function getCachedMatches(): Match[] | null {
  return matchesCache;
}

// --- Streamers ---

export async function getStreamers(): Promise<Streamer[]> {
  if (isClient && streamersCache) return streamersCache;
  const q = query(collection(db, 'streamers'), orderBy('name'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => {
    const data = d.data();
    const updatedAt = data.profileImageUpdatedAt as Timestamp | undefined;
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      // 저장돼 있으면 Date로 변환 (없으면 필드 자체를 제외해 undefined 유지)
      ...(updatedAt ? { profileImageUpdatedAt: updatedAt.toDate() } : {}),
    };
  }) as Streamer[];
  if (isClient) streamersCache = list;
  return list;
}

export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'streamers'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  streamersCache = null; // 변경됨 → 다음 조회 시 새로고침
  return ref.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'streamers', id));
  streamersCache = null;
}

// 미매칭 슬롯 자가학습: 인게임 이름을 스트리머의 gameNames에 append.
// 이미 존재하는 값이면 Firestore arrayUnion이 중복을 방지한다.
export async function appendGameName(streamerId: string, gameName: string): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), {
    gameNames: arrayUnion(gameName),
  });
  streamersCache = null;
}

// 스트리머의 gameNames 전체를 교체 (편집 모달에서 직접 수정할 때 사용).
export async function updateStreamerGameNames(streamerId: string, gameNames: string[]): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), { gameNames });
  streamersCache = null;
}

// 치지직에서 가져온 프로필 사진 URL과 갱신 시각을 저장.
// imageUrl이 빈 문자열이어도 갱신 시각은 기록 — TTL이 지나기 전 재조회를 막는다.
export async function updateStreamerProfileImage(streamerId: string, imageUrl: string): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), {
    profileImageUrl: imageUrl,
    profileImageUpdatedAt: Timestamp.now(),
  });
  streamersCache = null;
}

// --- Matches ---

export async function getMatches(): Promise<Match[]> {
  if (isClient && matchesCache) return matchesCache;
  const q = query(collection(db, 'matches'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    date: (d.data().date as Timestamp).toDate(),
    createdAt: (d.data().createdAt as Timestamp).toDate(),
  })) as Match[];
  if (isClient) matchesCache = list;
  return list;
}

export async function getMatch(id: string): Promise<Match | null> {
  const d = await getDoc(doc(db, 'matches', id));
  if (!d.exists()) return null;
  return {
    id: d.id,
    ...d.data(),
    date: (d.data().date as Timestamp).toDate(),
    createdAt: (d.data().createdAt as Timestamp).toDate(),
  } as Match;
}

export async function addMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<string> {
  // Firestore는 undefined 값을 거부하므로 leftTeam이 없으면 필드 자체를 제외
  const { leftTeam, ...rest } = data;
  const payload: Record<string, unknown> = {
    ...rest,
    date: Timestamp.fromDate(data.date),
    createdAt: Timestamp.now(),
  };
  if (leftTeam !== undefined) payload.leftTeam = leftTeam;

  const ref = await addDoc(collection(db, 'matches'), payload);
  matchesCache = null; // 변경됨 → 다음 조회 시 새로고침
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await deleteDoc(doc(db, 'matches', id));
  matchesCache = null;
}
