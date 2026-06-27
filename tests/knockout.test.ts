import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateKnockoutBracket,
  knockoutRounds,
  knockoutTotalMatches,
  roundName,
  generateFixturesForAll,
  generateFixturesForPlayer,
} from "@/lib/fixtures";
import { determineWinner, buildBracketView } from "@/lib/knockout";


// ROUNDS TESTS
describe("knockoutRounds", async () => {
  it("returns 0 for <2 players", () => {
    assert.equal(knockoutRounds(0), 0);
    assert.equal(knockoutRounds(1), 0);
  });
  it("correct for power of 2", () => {
    assert.equal(knockoutRounds(2), 1);
    assert.equal(knockoutRounds(4), 2);
    assert.equal(knockoutRounds(8), 3);
    assert.equal(knockoutRounds(16), 4);
  });
  it("rounds up for non-power-of-2", () => {
    assert.equal(knockoutRounds(3), 2);
    assert.equal(knockoutRounds(5), 3);
    assert.equal(knockoutRounds(7), 3);
    assert.equal(knockoutRounds(6), 3);
  });
});

describe("determineWinner", () => {
  assert.equal(determineWinner({homeGoals:3,awayGoals:1,homePlayerId:"h",awayPlayerId:"a",status:"completed"}), "h");
  assert.equal(determineWinner({homeGoals:1,awayGoals:3,homePlayerId:"h",awayPlayerId:"a",status:"completed"}), "a");
  assert.equal(determineWinner({homeGoals:null,awayGoals:null,homePlayerId:"h",awayPlayerId:"a",status:"scheduled"}), null);
  assert.equal(determineWinner({homeGoals:2,awayGoals:2,homePlayerId:"h",awayPlayerId:"a",status:"completed"}), null);
  assert.equal(determineWinner({homeGoals:null,awayGoals:null,homePlayerId:"h",awayPlayerId:null,status:"bye"}), "h");
  assert.equal(determineWinner({homeGoals:null,awayGoals:null,homePlayerId:null,awayPlayerId:"a",status:"bye"}), "a");
});

describe("generateKnockoutBracket", () => {
  assert.deepEqual(generateKnockoutBracket([]), []);
  assert.deepEqual(generateKnockoutBracket(["p1"]), []);
  const b2 = generateKnockoutBracket(["p1","p2"]);
  assert.equal(b2.length, 1);
  assert.equal(b2[0].homePlayerId, "p1");
  assert.equal(b2[0].awayPlayerId, "p2");
  const b4 = generateKnockoutBracket(["p1","p2","p3","p4"]);
  assert.equal(b4.length, 3);
  const r0 = b4.filter(m=>m.round===0).sort((a,b)=>a.bracketPosition-b.bracketPosition);
          const b8 = generateKnockoutBracket(Array.from({length:8},(_,i)=>"p"+(i+1)));
  assert.equal(b8.length, 7);
  assert.equal(b8.filter(m=>m.round===0).length, 4);
  assert.equal(b8.filter(m=>m.round===1).length, 2);
  assert.equal(b8.filter(m=>m.round===2).length, 1);
  const b3 = generateKnockoutBracket(["p1","p2","p3"]);
  assert.equal(b3.filter(m=>m.status==="bye").length, 1);
});

describe("buildBracketView", () => {
  const p = new Map([["p1",{name:"Alice",avatar:null}],["p2",{name:"Bob",avatar:null}]]);
  const now = new Date();
  const m = [
    {id:"m1",round:0,bracketPosition:0,homePlayerId:"p1",awayPlayerId:"p2",homeGoals:2,awayGoals:1,status:"completed",playedAt:now,nextMatchId:"m2",leg:"",winnerOverride:null},
    {id:"m2",round:1,bracketPosition:0,homePlayerId:"p1",awayPlayerId:null,homeGoals:null,awayGoals:null,status:"scheduled",playedAt:null,nextMatchId:null,leg:"",winnerOverride:null},
  ];
  const v = buildBracketView(m as any, p, 2);
  assert.equal(v.length, 2);
  assert.equal(v[0].name, "Semi-Finals");
  assert.equal(v[1].name, "Final");
  assert.equal(v[1].matches[0].homePlayer!.name, "Alice");
  assert.deepEqual(buildBracketView([], new Map(), 0), []);
});

describe("generateFixturesForAll", () => {
  assert.equal(generateFixturesForAll(["p1","p2","p3"]).length, 6);
  const f = generateFixturesForAll(["p1","p2"]);
  assert.equal(f.length, 2);
  assert(f.some(x=>x.homePlayerId==="p1"&&x.awayPlayerId==="p2"));
});

describe("generateFixturesForPlayer", () => {
  assert.equal(generateFixturesForPlayer("new", [{id:"e1"}]).length, 2);
  assert.deepEqual(generateFixturesForPlayer("new", []), []);
});
