const MIN_TEAM_SIZE = 5;

type Team = [string, string][];
type Result = { valid: true } | { valid: false; error: string };

export function validateMatchForm(blueTeam: Team, redTeam: Team): Result {
  if (blueTeam.length < MIN_TEAM_SIZE || redTeam.length < MIN_TEAM_SIZE)
    return { valid: false, error: `양 팀 모두 ${MIN_TEAM_SIZE}명이어야 합니다.` };
  const hasEmptyHero = [...blueTeam, ...redTeam].some(([, hero]) => !hero.trim());
  if (hasEmptyHero)
    return { valid: false, error: '모든 플레이어의 영웅명을 입력해주세요.' };
  const blueIds = new Set(blueTeam.map(([id]) => id));
  const hasDuplicate = redTeam.some(([id]) => blueIds.has(id));
  if (hasDuplicate)
    return { valid: false, error: '같은 스트리머가 양 팀에 등록되어 있습니다.' };
  return { valid: true };
}
