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

// --- Streamers ---

export async function getStreamers(): Promise<Streamer[]> {
  const q = query(collection(db, 'streamers'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: (d.data().createdAt as Timestamp).toDate(),
  })) as Streamer[];
}

export async function addStreamer(data: Omit<Streamer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'streamers'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function deleteStreamer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'streamers', id));
}

// 미매칭 슬롯 자가학습: 인게임 이름을 스트리머의 gameNames에 append.
// 이미 존재하는 값이면 Firestore arrayUnion이 중복을 방지한다.
export async function appendGameName(streamerId: string, gameName: string): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), {
    gameNames: arrayUnion(gameName),
  });
}

// 스트리머의 gameNames 전체를 교체 (편집 모달에서 직접 수정할 때 사용).
export async function updateStreamerGameNames(streamerId: string, gameNames: string[]): Promise<void> {
  await updateDoc(doc(db, 'streamers', streamerId), { gameNames });
}

// --- Matches ---

export async function getMatches(): Promise<Match[]> {
  const q = query(collection(db, 'matches'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    date: (d.data().date as Timestamp).toDate(),
    createdAt: (d.data().createdAt as Timestamp).toDate(),
  })) as Match[];
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
  return ref.id;
}

export async function deleteMatch(id: string): Promise<void> {
  await deleteDoc(doc(db, 'matches', id));
}
