import { getScrimsCachedServer } from '@/lib/firestore.server';
import ScrimHeroesClient from '@/components/scrim-heroes-client';

export default async function ScrimHeroesPage() {
  const scrims = await getScrimsCachedServer();
  return <ScrimHeroesClient scrims={scrims} />;
}
