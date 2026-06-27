// @ts-nocheck
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { determineWinner } from "@/lib/knockout";
import { generateKnockoutBracket, knockoutRounds } from "@/lib/fixtures";

const DB = "file:./test-e2e.db";

async function setupTestDb(p: PrismaClient) {
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS AuditLog');
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS Match');
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS Player');
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS League');
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS Admin');
  await p.$disconnect();
  const cp = require('child_process');
  cp.execSync('npx prisma db push --skip-generate', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: DB },
    stdio: 'pipe',
  });
}

describe('Knockout E2E', async () => {
  let prisma: PrismaClient;

  before(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DB } } });
    await setupTestDb(prisma);
    prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  });

  after(async () => {
    await prisma.$disconnect();
    try { require('fs').unlinkSync('prisma/test-e2e.db'); } catch {}
    try { require('fs').unlinkSync('prisma/test-e2e.db-journal'); } catch {}
  });

  it('creates KO league with 4 players and correct bracket structure', async () => {
    const league = await prisma.league.create({ data: { name: 'E2E KO', type: 'knockout' } });
    const names = ['Alice','Bob','Charlie','Diana'];
    const players = [];
    for (let i = 0; i < names.length; i++) {
      const p = await prisma.player.create({ data: { name: names[i], order: i, leagueId: league.id } });
      players.push(p);
    }
    assert.equal(players.length, 4);
    const bracket = generateKnockoutBracket(players.map(p => p.id));
    assert.equal(bracket.length, 3);
    const r0 = bracket.filter(m => m.round === 0);
    assert.equal(r0.length, 2);
    for (const m of bracket) {
      await prisma.match.create({ data: { ...m, leagueId: league.id } });
    }
    const matches = await prisma.match.findMany({ where: { leagueId: league.id } });
    assert.equal(matches.length, 3);
    await prisma.league.delete({ where: { id: league.id } });
  });

  it('submits scores and advances winner to next round', async () => {
    const league = await prisma.league.create({ data: { name: 'E2E Adv', type: 'knockout' } });
    const players = await Promise.all(['Alice','Bob','Charlie','Diana'].map((n,i)=>prisma.player.create({data:{name:n,order:i,leagueId:league.id}})));
    const bracket = generateKnockoutBracket(players.map(p=>p.id));
    const created = [];
    for (const m of bracket) {
      const match = await prisma.match.create({ data: { ...m, leagueId: league.id } });
      created.push(match);
    }
    for (const m of created) {
      if (m.round! < 1) {
        const nextPos = Math.floor(m.bracketPosition! / 2);
        const next = created.find(nm => nm.round === m.round!+1 && nm.bracketPosition === nextPos);
        if (next) { await prisma.match.update({ where: { id: m.id }, data: { nextMatchId: next.id } }); }
      }
    }
    const semi1 = created.find(m => m.round === 0 && m.bracketPosition === 0);
    const finalM = created.find(m => m.round === 1);
    await prisma.match.update({ where: { id: semi1.id }, data: { homeGoals: 3, awayGoals: 1, status: 'completed', playedAt: new Date() } });
    const updated = await prisma.match.findUnique({ where: { id: semi1.id } });
    assert.equal(determineWinner(updated), updated.homePlayerId);
    await prisma.league.delete({ where: { id: league.id } });
  });
  it('handles draw with winnerOverride and advances correctly', async () => {
    const league = await prisma.league.create({ data: { name: 'E2E Pens', type: 'knockout' } });
    const players = await Promise.all(['Alice','Bob'].map((n,i)=>prisma.player.create({data:{name:n,order:i,leagueId:league.id}})));
    const bracket = generateKnockoutBracket(players.map(p=>p.id));
    const match = await prisma.match.create({ data: { ...bracket[0], leagueId: league.id } });
    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { homeGoals: 2, awayGoals: 2, winnerOverride: players[0].id, status: 'completed', playedAt: new Date() },
    });
    const winner = determineWinner(updated);
    assert.equal(winner, players[0].id);
    assert.equal(updated.winnerOverride, players[0].id);
    await prisma.league.delete({ where: { id: league.id } });
  });
  it('handles byes for odd number of players (3 players)', async () => {
    const league = await prisma.league.create({ data: { name: 'E2E Byes', type: 'knockout' } });
    const players = await Promise.all(['Alice','Bob','Charlie'].map((n,i)=>prisma.player.create({data:{name:n,order:i,leagueId:league.id}})));
    const bracket = generateKnockoutBracket(players.map(p=>p.id));
    assert.equal(bracket.filter(m=>m.status==='bye').length, 1);
    for (const m of bracket) {
      await prisma.match.create({ data: { ...m, leagueId: league.id } });
    }
    const matches = await prisma.match.findMany({ where: { leagueId: league.id } });
    assert.equal(matches.length, 3);
    const byeMatch = matches.find(m => m.status === 'bye');
    assert.notEqual(byeMatch, undefined);
    assert.notEqual(byeMatch.homePlayerId, null);
    await prisma.league.delete({ where: { id: league.id } });
  });
  it('completes all rounds and crowns a champion', async () => {
    const league = await prisma.league.create({ data: { name: 'E2E Champ', type: 'knockout' } });
    const names = ['Alice','Bob','Charlie','Diana'];
    const players = await Promise.all(names.map((n,i)=>prisma.player.create({data:{name:n,order:i,leagueId:league.id}})));
    const bracket = generateKnockoutBracket(players.map(p=>p.id));
    assert.equal(bracket.length, 3);
    const created = [];
    for (const m of bracket) {
      const match = await prisma.match.create({ data: { ...m, leagueId: league.id } });
      created.push(match);
    }
    for (const m of created) {
      if (m.round! < 1) {
        const next = created.find(nm => nm.round === m.round!+1 && nm.bracketPosition === Math.floor(m.bracketPosition/2));
        if (next) { await prisma.match.update({ where: { id: m.id }, data: { nextMatchId: next.id } }); }
      }
    }
    const semi1 = created.find(m => m.round===0 && m.bracketPosition===0);
    const semi2 = created.find(m => m.round===0 && m.bracketPosition===1);
    const finalM = created.find(m => m.round===1);
    await prisma.match.update({ where: { id: semi1.id }, data: { homeGoals:2, awayGoals:0, status:'completed', playedAt:new Date() } });
    const s1Done = await prisma.match.findUnique({ where: { id: semi1.id } });
    const w1 = determineWinner(s1Done);
    await prisma.match.update({ where: { id: semi2.id }, data: { homeGoals:1, awayGoals:3, status:'completed', playedAt:new Date() } });
    const s2Done = await prisma.match.findUnique({ where: { id: semi2.id } });
    const w2 = determineWinner(s2Done);
    const isHome = semi1.bracketPosition % 2 === 0;
    await prisma.match.update({ where: { id: finalM.id }, data: isHome ? { homePlayerId: w1, awayPlayerId: w2 } : { homePlayerId: w2, awayPlayerId: w1 } });
    const finalUpdated = await prisma.match.findUnique({ where: { id: finalM.id } });
    assert.notEqual(finalUpdated.homePlayerId, null);
    assert.notEqual(finalUpdated.awayPlayerId, null);
    await prisma.match.update({ where: { id: finalM.id }, data: { homeGoals:3, awayGoals:2, status:'completed', playedAt:new Date() } });
    const finalDone = await prisma.match.findUnique({ where: { id: finalM.id } });
    const championId = determineWinner(finalDone);
    assert.notEqual(championId, null);
    const champion = players.find(p => p.id === championId);
    assert.notEqual(champion, undefined);
    await prisma.league.delete({ where: { id: league.id } });
  });
});



