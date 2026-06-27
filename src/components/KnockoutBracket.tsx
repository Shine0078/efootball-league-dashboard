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

  return (
    <div className="card overflow-x-auto p-4 sm:p-6">
      <div className="flex gap-6 min-w-max" style={{ marginTop: 0 }}>
        {rounds.map((round, ri) => {
          const gapFactor = Math.pow(2, ri);
          return (
            <div key={round.round} className="flex flex-col">
              <h3 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-pitch-400">
                {round.name}
              </h3>
              <div className="flex flex-1 flex-col justify-around" style={{ gap: gapFactor > 1 ? `${gapFactor * 1.5}rem` : "1rem" }}>
                {round.matches.map((match) => (
                  <BracketMatch
                    key={match.id}
                    match={match}
                    isFinal={round.name === "Final"}
                    onEdit={onEditMatch ? () => onEditMatch(match.id) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  isFinal,
  onEdit,
}: {
  match: BracketMatchData;
  isFinal: boolean;
  onEdit?: () => void;
}) {
  const homeG = match.homeGoals;
  const awayG = match.awayGoals;
  const isDraw = match.status === "completed" && homeG != null && awayG != null && homeG === awayG;
  const homeWinner = match.status === "completed" && homeG != null && awayG != null && (homeG > awayG || (isDraw && match.winnerOverride === match.homePlayer?.id));
  const awayWinner = match.status === "completed" && homeG != null && awayG != null && (awayG > homeG || (isDraw && match.winnerOverride === match.awayPlayer?.id));
  const isBye = match.status === "bye";

  return (
    <div
      className={`group relative w-56 rounded-xl border p-3 transition ${
        isFinal
          ? "border-pitch-500/40 bg-pitch-950/30 shadow-lg shadow-pitch-950/40"
          : "border-white/[0.08] bg-slate-950/50"
      } hover:border-pitch-500/30`}
    >
      {isFinal && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-pitch-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          ðŸ†
        </span>
      )}

      <div className="space-y-1.5">
        <PlayerSlot
          player={match.homePlayer}
          goals={homeG}
          winner={homeWinner}
          isBye={isBye && !!match.homePlayer}
          onEdit={onEdit}
        />
        <div className="flex items-center gap-1">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">vs</span>
          {isDraw && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">pens</span>}
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <PlayerSlot
          player={match.awayPlayer}
          goals={awayG}
          winner={awayWinner}
          isBye={isBye && !!match.awayPlayer}
          onEdit={onEdit}
        />
      </div>

      {onEdit && match.status !== "bye" && (
        <button
          onClick={onEdit}
          className="mt-2 w-full rounded-lg bg-white/[0.04] py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-pitch-600 hover:text-white"
        >
          Edit Score
        </button>
      )}
    </div>
  );
}

function PlayerSlot({
  player,
  goals,
  winner,
  isBye,
  onEdit,
}: {
  player: { id: string; name: string; avatar: string | null } | null;
  goals: number | null;
  winner: boolean;
  isBye: boolean;
  onEdit?: () => void;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 opacity-40">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-slate-800 text-[10px] text-slate-500">?</div>
        <span className="text-sm text-slate-500">TBD</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg px-1 py-1.5 transition ${winner ? "bg-pitch-500/10" : ""}`}>
      <img src={initialsAvatar(player.name, player.avatar)} alt="" className="h-6 w-6 rounded-md ring-1 ring-white/10" />
      <span className={`flex-1 truncate text-sm ${winner ? "font-bold text-white" : "text-slate-300"}`}>
        {player.name}
      </span>
      {goals != null && (
        <span className={`text-lg font-black tabular-nums ${winner ? "text-pitch-400" : "text-slate-500"}`}>
          {goals}
        </span>
      )}
      {isBye && (
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">Bye</span>
      )}
    </div>
  );
}
