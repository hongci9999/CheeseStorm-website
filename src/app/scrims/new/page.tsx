import { getScrimsCachedServer } from '@/lib/firestore.server';
import { heroScrimStats } from '@/lib/scrim-stats';
import ScrimNewClient from '@/components/scrim-new-client';

// 영웅 그리드를 밴픽률순으로 정렬하려면 기존 기록의 관여율이 필요하다.
// 캐시된 서버 조회라 캐시 히트 시 Firestore 읽기 0.
export default async function ScrimNewPage() {
  const scrims = await getScrimsCachedServer();
  const presence = Object.fromEntries(
    heroScrimStats(scrims).map((h) => [h.hero, h.presenceRate]),
  );

  return <ScrimNewClient presence={presence} />;
}
