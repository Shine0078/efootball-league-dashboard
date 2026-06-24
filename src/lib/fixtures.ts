/** For a newly added player, generate home+away legs against every existing player. */
export function generateFixturesForPlayer(
  newPlayerId: string,
  existing: { id: string }[]
): { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] {
  const fixtures: { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] = [];
  for (const other of existing) {
    // new player home leg vs other
    fixtures.push({ homePlayerId: newPlayerId, awayPlayerId: other.id, leg: "home", status: "scheduled" });
    // new player away leg vs other (other is home)
    fixtures.push({ homePlayerId: other.id, awayPlayerId: newPlayerId, leg: "away", status: "scheduled" });
  }
  return fixtures;
}

/** Generate the full double round-robin for N players. */
export function generateFixturesForAll(
  playerIds: string[]
): { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] {
  const fixtures: { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = 0; j < playerIds.length; j++) {
      if (i === j) continue;
      const home = playerIds[i];
      const away = playerIds[j];
      fixtures.push({ homePlayerId: home, awayPlayerId: away, leg: i < j ? "home" : "away", status: "scheduled" });
    }
  }
  return fixtures;
}