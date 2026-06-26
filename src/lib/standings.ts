import type { Match, Player } from "@prisma/client";

export interface StandingsRow {
  playerId: string;
  name: string;
  avatar: string | null;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: ("W" | "D" | "L")[];
}

export interface CompletedMatchWithPlayers extends Match {
  homePlayer: Pick<Player, "id" | "name"> | null;
  awayPlayer: Pick<Player, "id" | "name"> | null;
}

export type MostLossesPlayer = { name: string; losses: number };

const FORM_LIMIT = 5;

export function computeStandings(
  players: Pick<Player, "id" | "name" | "avatar">[],
  matches: CompletedMatchWithPlayers[],
  lastUpdated?: string
): { rows: StandingsRow[]; lastUpdated: string } {
  const map = new Map<string, StandingsRow>();

  for (const p of players) {
    map.set(p.id, {
      playerId: p.id,
      name: p.name,
      avatar: p.avatar ?? null,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      form: [],
    });
  }

  const sorted = [...matches]
    .filter((m) => m.status === "completed" && m.homeGoals != null && m.awayGoals != null)
    .sort((a, b) => {
      const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
      const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
      return ta - tb;
    });

  for (const m of sorted) {
    if (!m.homePlayerId || !m.awayPlayerId) continue;
    const home = map.get(m.homePlayerId);
    const away = map.get(m.awayPlayerId);
    if (!home || !away) continue;

    const hg = m.homeGoals as number;
    const ag = m.awayGoals as number;

    home.mp++;
    away.mp++;
    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    if (hg > ag) {
      home.w++;
      home.pts += 3;
      away.l++;
      home.form.push("W");
      away.form.push("L");
    } else if (hg < ag) {
      away.w++;
      away.pts += 3;
      home.l++;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.d++;
      away.d++;
      home.pts += 1;
      away.pts += 1;
      home.form.push("D");
      away.form.push("D");
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  for (const row of map.values()) {
    row.form = row.form.slice(-FORM_LIMIT).reverse();
  }

  const rows = [...map.values()].sort((a, b) =>
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );

  return { rows, lastUpdated: lastUpdated ?? new Date().toISOString() };
}

export function fixturesTotal(n: number): number {
  return n <= 1 ? 0 : n * (n - 1);
}

type LossesAccumulator = {
  name: string;
  losses: number;
  pts: number;
  gd: number;
};

function hasCompletedScore(match: Match): match is Match & { homeGoals: number; awayGoals: number } {
  return match.status === "completed" && match.homeGoals != null && match.awayGoals != null;
}

export function getMostLossesPlayer(matches: Match[], players: Player[]): MostLossesPlayer | null {
  const table = new Map<string, LossesAccumulator>();
  for (const player of players) {
    table.set(player.id, { name: player.name, losses: 0, pts: 0, gd: 0 });
  }

  let completedMatches = 0;
  for (const match of matches) {
    if (!hasCompletedScore(match)) continue;
    if (!match.homePlayerId || !match.awayPlayerId) continue;
    const home = table.get(match.homePlayerId);
    const away = table.get(match.awayPlayerId);
    if (!home || !away) continue;

    completedMatches++;
    if (match.homeGoals > match.awayGoals) {
      home.pts += 3;
      away.losses++;
    } else if (match.homeGoals < match.awayGoals) {
      away.pts += 3;
      home.losses++;
    } else {
      home.pts += 1;
      away.pts += 1;
    }
    home.gd += match.homeGoals - match.awayGoals;
    away.gd += match.awayGoals - match.homeGoals;
  }

  if (completedMatches === 0) return null;

  const [player] = [...table.values()].sort(
    (a, b) => b.losses - a.losses || a.pts - b.pts || a.gd - b.gd || b.name.localeCompare(a.name)
  );
  return player ? { name: player.name, losses: player.losses } : null;
}
