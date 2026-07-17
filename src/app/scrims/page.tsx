import { cookies } from 'next/headers';
import { getScrimsCachedServer } from '@/lib/firestore.server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import ScrimsClient from '@/components/scrims-client';

export default async function ScrimsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isStreamer = session?.role === 'streamer' || session?.role === 'admin';

  const scrims = await getScrimsCachedServer();

  return <ScrimsClient scrims={scrims} isStreamer={isStreamer} />;
}
