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
