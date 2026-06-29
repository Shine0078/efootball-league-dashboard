"use client";

import { initialsAvatar } from "@/lib/avatar";

export interface BracketMatchData {
  id: string;
  round: number;
  bracketPosition: number;
  homePlayer: { id: string; name: string; avatar: string | null } | null;
  awayPlayer: { id: string; name: string; avatar: string | null } | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  winnerOverride: string | null;
}

export interface BracketRoundData {
  name: string;
  round: number;
  matches: BracketMatchData[];
}

const CARD_H = 68;
const CARD_GAP = 12;

function cardTop(index: number, roundIndex: number, totalRounds: number): number {
  const pairsInRound = Math.pow(2, totalRounds - 1 - roundIndex);
  const totalHeight = pairsInRound * CARD_H + (pairsInRound - 1) * CARD_GAP;
  const myPair = Math.floor(index / 2);
  const inPairIndex = index % 2;
  const pairHeight = 2 * CARD_H + CARD_GAP;
  return myPair * pairHeight + inPairIndex * (CARD_H + CARD_GAP);
}

function roundWidth(roundIndex: number, totalRounds: number): number {
  const r = roundIndex;
  return r === totalRounds - 1 ? 192 : 220;
}

export default function KnockoutBracket({
  rounds,
  onEditMatch,
}: {
  rounds: BracketRoundData[];
  onEditMatch?: (matchId: string) => void;
}) {
  if (!rounds.length) {
    return <div className="card p-8 text-center text-slate-500">No bracket matches yet.</div>;
  }

  const totalRounds = rounds.length;
  const roundColW = 220;
  const connW = 40;
  const firstRoundPairs = Math.pow(2, totalRounds - 1);
  const bracketH = firstRoundPairs * CARD_H + (firstRoundPairs - 1) * CARD_GAP;

  return (
    <div className="card overflow-x-auto overflow-y-visible p-4 sm:p-6">
      <div className="relative" style={{ height: bracketH + 40, minWidth: totalRounds * (roundColW + connW) + 60 }}>
        {/* Round columns + connectors */}
        {rounds.map((round, ri) => {
          const colLeft = ri * (roundColW + connW) + 20;
          const pairs = Math.pow(2, totalRounds - 1 - ri);
          const colH = pairs * CARD_H + (pairs - 1) * CARD_GAP;
          const colTop = (bracketH - colH) / 2;

          // For semi-finals and final, add a background highlight
          const isFinal = ri === totalRounds - 1;
          const isSemi = ri === totalRounds - 2;

          return (
            <div key={ri}>
              {/* Round header */}
              <div
                className="absolute text-center"
                style={{
                  left: colLeft,
                  top: 0,
                  width: ri === totalRounds - 1 ? 192 : roundColW,
                }}
              >
                <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                  isFinal
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/[0.05] text-slate-400"
                }`}>
                  {isFinal && "🏆 "}{round.name}
                </span>
              </div>

              {/* Match cards */}
              {round.matches.map((match, mi) => {
                const t = colTop + cardTop(mi, ri, totalRounds);
                const cardW = ri === totalRounds - 1 ? 192 : roundColW;
                return (
                  <div
                    key={match.id}
                    className="absolute rounded-lg border transition"
                    style={{
                      left: colLeft,
                      top: t,
                      width: cardW,
                      height: CARD_H,
                      borderColor: isFinal ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)",
                      background: isFinal
                        ? "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(120,53,15,0.15))"
                        : "rgba(2,6,23,0.6)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isFinal ? "rgba(251,191,36,0.5)" : "rgba(34,197,94,0.3)";
                      e.currentTarget.style.background = isFinal
                        ? "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(120,53,15,0.2))"
                        : "rgba(2,6,23,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isFinal ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)";
                      e.currentTarget.style.background = isFinal
                        ? "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(120,53,15,0.15))"
                        : "rgba(2,6,23,0.6)";
                    }}
                  >
                    <div className="flex h-full flex-col justify-center px-2.5" style={{ gap: 0 }}>
                      <PlayerSlot
                        player={match.homePlayer}
                        goals={match.homeGoals}
                        status={match.status}
                        winnerOverride={match.winnerOverride}
                        side="home"
                        isBye={match.status === "bye" && !!match.homePlayer}
                      />
                      <div className="h-px bg-white/[0.06]" />
                      <PlayerSlot
                        player={match.awayPlayer}
                        goals={match.awayGoals}
                        status={match.status}
                        winnerOverride={match.winnerOverride}
                        side="away"
                        isBye={match.status === "bye" && !!match.awayPlayer}
                      />
                    </div>

                    {/* Edit button */}
                    {onEditMatch && match.status !== "bye" && (
                      <button
                        onClick={() => onEditMatch(match.id)}
                        className="absolute -right-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-pitch-600 text-[9px] text-white opacity-0 transition hover:bg-pitch-500 group-hover:opacity-100"
                        style={{ opacity: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                      >
                        ✎
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Connector to next round (not for final) */}
              {ri < totalRounds - 1 && (
                <ConnectorLines
                  pairs={pairs / 2}
                  colLeft={colLeft + roundColW}
                  colTop={colTop}
                  nextColTop={colTop + (pairs / 2) * CARD_H + (pairs / 2 - 1) * CARD_GAP}
                  connWidth={connW}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectorLines({
  pairs,
  colLeft,
  colTop,
  nextColTop,
  connWidth,
}: {
  pairs: number;
  colLeft: number;
  colTop: number;
  nextColTop: number;
  connWidth: number;
}) {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const pairHeight = 2 * CARD_H + CARD_GAP;

  for (let i = 0; i < pairs; i++) {
    const startX = colLeft;
    const midX = colLeft + connWidth / 2;
    const endX = colLeft + connWidth;
    const topY = colTop + i * pairHeight + CARD_H / 2;
    const botY = colTop + i * pairHeight + CARD_H + CARD_GAP + CARD_H / 2;
    const midY = (topY + botY) / 2;
    const nextY = nextColTop + i * pairHeight + pairHeight / 2;

    // Top match → right → center
    lines.push({ x1: startX, y1: topY, x2: midX, y2: topY });
    // Bottom match → right → center
    lines.push({ x1: startX, y1: botY, x2: midX, y2: botY });
    // Vertical connector
    lines.push({ x1: midX, y1: topY, x2: midX, y2: botY });
    // Center → right → next round
    lines.push({ x1: midX, y1: midY, x2: endX, y2: midY });
    // To next match
    lines.push({ x1: endX, y1: midY, x2: endX + 0, y2: nextY });
  }

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

function PlayerSlot({
  player,
  goals,
  status,
  winnerOverride,
  side,
  isBye,
}: {
  player: { id: string; name: string; avatar: string | null } | null;
  goals: number | null;
  status: string;
  winnerOverride: string | null;
  side: "home" | "away";
  isBye: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-1.5 rounded px-1 py-0.5 opacity-40" style={{ height: CARD_H / 2 - 1 }}>
        <div className="grid h-4 w-4 shrink-0 place-items-center rounded bg-slate-800 text-[8px] text-slate-500">?</div>
        <span className="truncate text-[11px] text-slate-500">TBD</span>
      </div>
    );
  }

  const isDraw = status === "completed" && goals != null &&
    (side === "home" ? (goals === null) : false);
  // Actually compute draw correctly via context from parent... 
  // We pass winner info from parent via match data
  
  const penWinner = status === "completed" && goals != null && winnerOverride === player.id;

  return (
    <div
      className={`flex items-center gap-1.5 rounded px-1 transition`}
      style={{ height: CARD_H / 2 - 1 }}
    >
      <img
        src={initialsAvatar(player.name, player.avatar)}
        alt=""
        className="h-4 w-4 shrink-0 rounded ring-1 ring-white/10"
      />
      <span className="flex-1 truncate text-[11px] font-medium text-slate-200">
        {player.name}
      </span>
      {goals != null && (
        <span className="text-xs font-bold tabular-nums text-white">
          {goals}
        </span>
      )}
      {isBye && (
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-400">Bye</span>
      )}
      {penWinner && (
        <span className="text-[9px] text-amber-400">(P)</span>
      )}
    </div>
  );
}
