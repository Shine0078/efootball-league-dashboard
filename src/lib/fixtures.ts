/** For a newly added player, generate home+away legs against every existing player. */
export function generateFixturesForPlayer(
  newPlayerId: string,
  existing: { id: string }[]
): { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] {
  const fixtures: { homePlayerId: string; awayPlayerId: string; leg: string; status: string }[] = [];
  for (const other of existing) {
    fixtures.push({ homePlayerId: newPlayerId, awayPlayerId: other.id, leg: "home", status: "scheduled" });
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

export interface BracketMatchData {
  round: number;
  bracketPosition: number;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  status: string;
  leg: string;
}

export function knockoutRounds(playerCount: number): number {
  if (playerCount < 2) return 0;
  return Math.ceil(Math.log2(playerCount));
}

export function knockoutTotalMatches(playerCount: number): number {
  if (playerCount < 2) return 0;
  const rounds = knockoutRounds(playerCount);
  const bracketSize = Math.pow(2, rounds);
  return bracketSize - 1;
}

function standardSeedOrder(bracketSize: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < bracketSize) {
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(2 * seeds.length + 1 - s + seeds.length);
    }
    seeds = next;
  }
  return seeds.slice(0, bracketSize);
}

export function generateKnockoutBracket(
  playerIds: string[]
): BracketMatchData[] {
  const n = playerIds.length;
  if (n < 2) return [];

  const rounds = knockoutRounds(n);
  const bracketSize = Math.pow(2, rounds);
  const byes = bracketSize - n;

  const seedOrder = standardSeedOrder(bracketSize);
  const slots: (string | null)[] = new Array(bracketSize).fill(null);

  let playerIdx = 0;
  for (const seed of seedOrder) {
    if (seed <= n) {
      slots[seed - 1] = playerIds[playerIdx];
      playerIdx++;
    } else {
      slots[seed - 1] = null;
    }
  }

  const matches: BracketMatchData[] = [];

  for (let r = 0; r < rounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);

    if (r === 0) {
      for (let i = 0; i < matchesInRound; i++) {
        const home = slots[i * 2];
        const away = slots[i * 2 + 1];
        const isBye = home === null || away === null;
        const bothNull = home === null && away === null;
        matches.push({
          round: r,
          bracketPosition: i,
          homePlayerId: home,
          awayPlayerId: away,
          status: bothNull ? "scheduled" : isBye ? "bye" : "scheduled",
          leg: "",
        });
      }
    } else {
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          round: r,
          bracketPosition: i,
          homePlayerId: null,
          awayPlayerId: null,
          status: "scheduled",
          leg: "",
        });
      }
    }
  }

  return matches;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-Final";
  if (fromEnd === 2) return "Quarter-Final";
  return `Round ${round + 1}`;
}