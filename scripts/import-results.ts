import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [matchday, team1, score1, team2, score2] — null scores = unplayed
type MatchRow = [number, string, number | null, string, number | null];

const MATCHES: MatchRow[] = [
  // Matchday 1
  [1, "ANISH", 2, "ELDHOSE VARGHESE", 0],
  [1, "ELDHOSE VARGHESE", 0, "ANISH", 1],
  [1, "SANTO", 2, "ROSHAN", 5],
  [1, "ROSHAN", 2, "SANTO", 3],
  [1, "THOMAS PAILY", 0, "ALAN", 1],
  [1, "ALAN", 1, "THOMAS PAILY", 1],
  [1, "THOMAS ELDHO", 3, "JUVAL", 3],
  [1, "JUVAL", 1, "THOMAS ELDHO", 3],
  [1, "ABIN CHAAKOOCHI", 0, "AZAD", 2],
  [1, "AZAD", 4, "ABIN CHAAKOOCHI", 5],
  [1, "ABIN ELDHO", 2, "THOMAS ROY", 1],
  [1, "THOMAS ROY", 2, "ABIN ELDHO", 0],
  [1, "ALEN JOSEPH", 1, "THOMMY", 3],
  [1, "THOMMY", 2, "ALEN JOSEPH", 0],
  [1, "BOOT ALBIN", 2, "TUTTU", 2],
  [1, "TUTTU", 1, "BOOT ALBIN", 2],
  [1, "EBIN JOY", 3, "ELDHOSE KOCHEECHA", 3],
  [1, "ELDHOSE KOCHEECHA", 1, "EBIN JOY", 3],

  // Matchday 2
  [2, "ROBIN JR", 1, "ELDHOSE VARGHESE", 2],
  [2, "ELDHOSE VARGHESE", 1, "ROBIN JR", 2],
  [2, "ANISH", 2, "ALAN", 2],
  [2, "ALAN", 4, "ANISH", 2],
  [2, "SANTO", 0, "JUVAL", 3],
  [2, "JUVAL", 2, "SANTO", 1],
  [2, "THOMAS PAILY", 1, "AZAD", 0],
  [2, "AZAD", 2, "THOMAS PAILY", 0],
  [2, "THOMAS ELDHO", 1, "THOMAS ROY", 4],
  [2, "THOMAS ROY", 2, "THOMAS ELDHO", 4],
  [2, "ABIN CHAAKOOCHI", 5, "THOMMY", 2],
  [2, "THOMMY", 1, "ABIN CHAAKOOCHI", 1],
  [2, "ABIN ELDHO", 3, "TUTTU", 1],
  [2, "TUTTU", 2, "ABIN ELDHO", 5],
  [2, "ALEN JOSEPH", 1, "ELDHOSE KOCHEECHA", 2],
  [2, "ELDHOSE KOCHEECHA", 0, "ALEN JOSEPH", 1],
  [2, "BOOT ALBIN", 1, "EBIN JOY", 6],
  [2, "EBIN JOY", 2, "BOOT ALBIN", 1],

  // Matchday 3
  [3, "ROBIN JR", 1, "ROSHAN", 2],
  [3, "ROSHAN", 2, "ROBIN JR", 1],
  [3, "ELDHOSE VARGHESE", 1, "ALAN", 3],
  [3, "ALAN", 4, "ELDHOSE VARGHESE", 0],
  [3, "ANISH", 2, "AZAD", 1],
  [3, "AZAD", 2, "ANISH", 3],
  [3, "SANTO", 2, "THOMAS ROY", 1],
  [3, "THOMAS ROY", 2, "SANTO", 1],
  [3, "THOMAS PAILY", 0, "THOMMY", 3],
  [3, "THOMMY", 3, "THOMAS PAILY", 0],
  [3, "THOMAS ELDHO", 1, "TUTTU", 1],
  [3, "TUTTU", 1, "THOMAS ELDHO", 4],
  [3, "ABIN CHAAKOOCHI", 1, "ELDHOSE KOCHEECHA", 2],
  [3, "ELDHOSE KOCHEECHA", 2, "ABIN CHAAKOOCHI", 2],
  [3, "ABIN ELDHO", 3, "EBIN JOY", 4],
  [3, "EBIN JOY", 2, "ABIN ELDHO", 1],
  [3, "ALEN JOSEPH", 0, "BOOT ALBIN", 4],
  [3, "BOOT ALBIN", 3, "ALEN JOSEPH", 2],

  // Matchday 4
  [4, "ROBIN JR", 4, "ALAN", 2],
  [4, "ALAN", 2, "ROBIN JR", 6],
  [4, "ROSHAN", 4, "JUVAL", 0],
  [4, "JUVAL", 1, "ROSHAN", 1],
  [4, "ELDHOSE VARGHESE", 4, "AZAD", 4],
  [4, "AZAD", 2, "ELDHOSE VARGHESE", 2],
  [4, "ANISH", 1, "THOMMY", 1],
  [4, "THOMMY", 4, "ANISH", 3],
  [4, "SANTO", 1, "TUTTU", 2],
  [4, "TUTTU", 4, "SANTO", 1],
  [4, "THOMAS PAILY", 3, "ELDHOSE KOCHEECHA", 2],
  [4, "ELDHOSE KOCHEECHA", 3, "THOMAS PAILY", 1],
  [4, "THOMAS ELDHO", 1, "EBIN JOY", 2],
  [4, "EBIN JOY", 3, "THOMAS ELDHO", 1],
  [4, "ABIN CHAAKOOCHI", 3, "BOOT ALBIN", 0],
  [4, "BOOT ALBIN", 0, "ABIN CHAAKOOCHI", 1],
  [4, "ABIN ELDHO", 1, "ALEN JOSEPH", 4],
  [4, "ALEN JOSEPH", 1, "ABIN ELDHO", 1],

  // Matchday 5
  [5, "ROBIN JR", null, "JUVAL", null],
  [5, "JUVAL", null, "ROBIN JR", null],
  [5, "ALAN", 0, "AZAD", 5],
  [5, "AZAD", 0, "ALAN", 3],
  [5, "ROSHAN", 3, "THOMAS ROY", 1],
  [5, "THOMAS ROY", 2, "ROSHAN", 3],
  [5, "ELDHOSE VARGHESE", null, "THOMMY", null],
  [5, "THOMMY", null, "ELDHOSE VARGHESE", null],
  [5, "ANISH", null, "ELDHOSE KOCHEECHA", null],
  [5, "ELDHOSE KOCHEECHA", null, "ANISH", null],
  [5, "SANTO", 1, "EBIN JOY", 3],
  [5, "EBIN JOY", 2, "SANTO", 1],
  [5, "THOMAS PAILY", 3, "BOOT ALBIN", 0],
  [5, "BOOT ALBIN", 3, "THOMAS PAILY", 5],
  [5, "THOMAS ELDHO", 2, "ALEN JOSEPH", 1],
  [5, "ALEN JOSEPH", 3, "THOMAS ELDHO", 1],
  [5, "ABIN CHAAKOOCHI", null, "ABIN ELDHO", null],
  [5, "ABIN ELDHO", null, "ABIN CHAAKOOCHI", null],

  // Matchday 6
  [6, "ROBIN JR", 0, "AZAD", 3],
  [6, "AZAD", 1, "ROBIN JR", 4],
  [6, "JUVAL", 1, "THOMAS ROY", 2],
  [6, "THOMAS ROY", 2, "JUVAL", 2],
  [6, "ALAN", 1, "THOMMY", 4],
  [6, "THOMMY", 4, "ALAN", 1],
  [6, "ROSHAN", 5, "TUTTU", 2],
  [6, "TUTTU", 0, "ROSHAN", 7],
  [6, "ELDHOSE VARGHESE", null, "ELDHOSE KOCHEECHA", null],
  [6, "ELDHOSE KOCHEECHA", null, "ELDHOSE VARGHESE", null],
  [6, "ANISH", 5, "BOOT ALBIN", 1],
  [6, "BOOT ALBIN", 0, "ANISH", 3],
  [6, "SANTO", 4, "ALEN JOSEPH", 2],
  [6, "ALEN JOSEPH", 5, "SANTO", 0],
  [6, "THOMAS PAILY", 3, "ABIN ELDHO", 1],
  [6, "ABIN ELDHO", 2, "THOMAS PAILY", 2],
  [6, "THOMAS ELDHO", null, "ABIN CHAAKOOCHI", null],
  [6, "ABIN CHAAKOOCHI", null, "THOMAS ELDHO", null],

  // Matchday 7
  [7, "ROBIN JR", null, "THOMAS ROY", null],
  [7, "THOMAS ROY", null, "ROBIN JR", null],
  [7, "AZAD", null, "THOMMY", null],
  [7, "THOMMY", null, "AZAD", null],
  [7, "JUVAL", null, "TUTTU", null],
  [7, "TUTTU", null, "JUVAL", null],
  [7, "ALAN", null, "ELDHOSE KOCHEECHA", null],
  [7, "ELDHOSE KOCHEECHA", null, "ALAN", null],
  [7, "ROSHAN", null, "EBIN JOY", null],
  [7, "EBIN JOY", null, "ROSHAN", null],
  [7, "ELDHOSE VARGHESE", 1, "BOOT ALBIN", 3],
  [7, "BOOT ALBIN", 2, "ELDHOSE VARGHESE", 1],
  [7, "ANISH", null, "ABIN ELDHO", null],
  [7, "ABIN ELDHO", null, "ANISH", null],
  [7, "SANTO", null, "ABIN CHAAKOOCHI", null],
  [7, "ABIN CHAAKOOCHI", null, "SANTO", null],
  [7, "THOMAS PAILY", null, "THOMAS ELDHO", null],
  [7, "THOMAS ELDHO", null, "THOMAS PAILY", null],
];

async function main() {
  // 1. Ensure league exists
  const league = await prisma.league.upsert({
    where: { id: "league-efootball" },
    update: {},
    create: { id: "league-efootball", name: "eFootball League", type: "normal" },
  });
  console.log(`League ready: ${league.name} (${league.id})`);

  // 2. Extract unique team names and create/find players
  const uniqueNames = [...new Set(MATCHES.flatMap((m) => [m[1], m[3]]))].sort();
  console.log(`\nFound ${uniqueNames.length} unique teams in source data`);

  const playerMap = new Map<string, string>(); // name -> id

  for (let i = 0; i < uniqueNames.length; i++) {
    const name = uniqueNames[i];
    const existing = await prisma.player.findFirst({ where: { name, leagueId: league.id } });
    if (existing) {
      playerMap.set(name, existing.id);
    } else {
      const created = await prisma.player.create({
        data: { name, order: i, leagueId: league.id },
      });
      playerMap.set(name, created.id);
      console.log(`  Created player: ${name}`);
    }
  }

  const allPlayerNames = [...playerMap.keys()];
  console.log(`\nAll players: ${allPlayerNames.join(", ")}`);

  // 3. Upsert matches
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [matchday, team1, score1, team2, score2] of MATCHES) {
    const homeId = playerMap.get(team1);
    const awayId = playerMap.get(team2);
    if (!homeId || !awayId) {
      console.error(`  ERROR: Unknown team "${team1}" or "${team2}" in matchday ${matchday}`);
      continue;
    }

    const isPlayed = score1 !== null && score2 !== null;
    const status = isPlayed ? "completed" : "scheduled";

    // Find existing match by round + home + away
    const existing = await prisma.match.findFirst({
      where: { round: matchday, homePlayerId: homeId, awayPlayerId: awayId, leagueId: league.id },
    });

    if (existing) {
      // Check if scores changed
      const scoresDiffer =
        existing.homeGoals !== score1 ||
        existing.awayGoals !== score2 ||
        existing.status !== status;

      if (scoresDiffer) {
        await prisma.match.update({
          where: { id: existing.id },
          data: {
            homeGoals: score1,
            awayGoals: score2,
            status,
            playedAt: isPlayed ? new Date() : null,
          },
        });
        updated++;
        console.log(`  Updated: MD${matchday} ${team1} ${score1 ?? "-"} vs ${score2 ?? "-"} ${team2}`);
      } else {
        skipped++;
      }
    } else {
      await prisma.match.create({
        data: {
          homePlayerId: homeId,
          awayPlayerId: awayId,
          homeGoals: score1,
          awayGoals: score2,
          status,
          round: matchday,
          leagueId: league.id,
          leg: "",
          playedAt: isPlayed ? new Date() : null,
        },
      });
      created++;
    }
  }

  console.log(`\n--- Import Summary ---`);
  console.log(`Players: ${playerMap.size} total (${uniqueNames.length} in source)`);
  console.log(`Matches: ${created} created, ${updated} updated, ${skipped} skipped (no change)`);
  console.log(`Total rows processed: ${MATCHES.length}`);

  // 4. Verification: match counts per matchday
  console.log(`\n--- Matches per Matchday ---`);
  const matchdays = [...new Set(MATCHES.map((m) => m[0]))].sort((a, b) => a - b);
  for (const md of matchdays) {
    const count = await prisma.match.count({ where: { round: md, leagueId: league.id } });
    const played = await prisma.match.count({ where: { round: md, leagueId: league.id, status: "completed" } });
    console.log(`  Matchday ${md}: ${count} matches (${played} played, ${count - played} scheduled)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
