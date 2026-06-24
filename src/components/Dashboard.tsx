"use client";

import { useEffect, useRef, useState } from "react";
import { initialsAvatar } from "@/lib/avatar";
import type { StandingsRow } from "@/lib/standings";

type MatchData = {
  id: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  leg: string;
  playedAt: string | null;
  homePlayer: { id: string; name: string };
  awayPlayer: { id: string; name: string };
};

type PlayerData = { id: string; name: string; avatar: string | null };

type DataShape = {
  players: PlayerData[];
  matches: MatchData[];
  standings: StandingsRow[];
  lastUpdated: string;
  count: { players: number; matches: number };
};

const POLL_MS = 8000;

export default function Dashboard() {
  const [data, setData] = useState<DataShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prevStandKey, setPrevStandKey] = useState<string>("");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const tickRef = useRef(0);

  async function fetchData(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DataShape = await res.json();

      const newKey = json.standings.map((r) => `${r.playerId}:${r.pts}:${r.gf}:${r.ga}`).join("|");
      if (prevStandKey && newKey !== prevStandKey) {
        const changed = new Set<string>();
        const prevMap = new Map(prevStandKey.split("|").map((p) => p.split(":")).map((a) => [a[0], a.slice(1).join(":")]));
        for (const r of json.standings) {
          const pk = prevMap.get(r.playerId);
          if (pk && pk !== `${r.pts}:${r.gf}:${r.ga}`) changed.add(r.playerId);
        }
        setFlashIds(changed);
        setTimeout(() => setFlashIds(new Set()), 1500);
      }
      setPrevStandKey(newKey);
      setData(json);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setRefreshing(false);
      tickRef.current = 0;
    }
  }

  useEffect(() => {
    fetchData();
    let interval: ReturnType<typeof setInterval> | undefined;
    let counter: ReturnType<typeof setInterval> | undefined;

    interval = setInterval(() => fetchData(true), POLL_MS);
    counter = setInterval(() => (tickRef.current += 1), 1000);

    return () => { if (interval) clearInterval(interval); if (counter) clearInterval(counter); };
  }, []);

  const secondsAgo = tickRef.current;

  if (error && !data) {
    return <div className="card p-8 text-center text-slate-300">⚠️ Could not load league data. <button className="btn-ghost mt-4" onClick={() => fetchData()}>Retry</button></div>;
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  const completed = data.matches.filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.playedAt ?? 0).getTime() - new Date(a.playedAt ?? 0).getTime());
  const upcoming = data.matches.filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.homePlayer.name.localeCompare(b.homePlayer.name)));

  const topScorer = [...data.standings].sort((a, b) => b.gf - a.gf)[0];
  const bestGd = [...data.standings].sort((a, b) => b.gd - a.gd)[0];
  const played = completed.length;
  const total = data.matches.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">League Standings</h1>
          <p className="text-sm text-slate-400">
            {played}/{total} matches played · auto-updating
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`inline-flex items-center gap-1.5 ${refreshing ? "text-pitch-400" : ""}`}>
            <span className={`h-2 w-2 rounded-full ${refreshing ? "bg-pitch-400 animate-ping" : "bg-slate-600"}`} />
            {refreshing ? "Refreshing…" : `Updated ${secondsAgo}s ago`}
          </span>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => fetchData()}>Refresh</button>
        </div>
      </div>

      {error && <div className="card border-red-800/60 bg-red-950/40 p-3 text-sm text-red-300">⚠️ {error}</div>}

      <Highlights topScorer={topScorer} bestGd={bestGd} />

      <StandingsTable rows={data.standings} flashIds={flashIds} />

      <FixturesSection completed={completed} upcoming={upcoming} />
    </div>
  );
}

function Highlights({ topScorer, bestGd }: { topScorer?: StandingsRow; bestGd?: StandingsRow }) {
  if (!topScorer && !bestGd) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">Top Scorer</p>
        <p className="mt-1 flex items-center gap-2 font-bold">
          <img src={initialsAvatar(topScorer?.name ?? "", topScorer?.avatar)} alt="" className="h-7 w-7 rounded-md" />
          {topScorer?.name ?? "—"}
          <span className="ml-auto text-xl text-pitch-400">{topScorer?.gf ?? 0}</span>
        </p>
      </div>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">Best Goal Difference</p>
        <p className="mt-1 flex items-center gap-2 font-bold">
          <img src={initialsAvatar(bestGd?.name ?? "", bestGd?.avatar)} alt="" className="h-7 w-7 rounded-md" />
          {bestGd?.name ?? "—"}
          <span className={`ml-auto text-xl ${bestGd && bestGd.gd > 0 ? "text-pitch-400" : "text-slate-400"}`}>{bestGd ? (bestGd.gd > 0 ? `+${bestGd.gd}` : bestGd.gd) : "—"}</span>
        </p>
      </div>
    </div>
  );
}

function StandingsTable({ rows, flashIds }: { rows: StandingsRow[]; flashIds: Set<string> }) {
  const CUTOFF = 4;
  return (
    <div className="card overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-300">
            <tr className="text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-2 py-3 text-center">MP</th>
              <th className="px-2 py-3 text-center">W</th>
              <th className="px-2 py-3 text-center">D</th>
              <th className="px-2 py-3 text-center">L</th>
              <th className="px-2 py-3 text-center">GF</th>
              <th className="px-2 py-3 text-center">GA</th>
              <th className="px-2 py-3 text-center">GD</th>
              <th className="px-2 py-3 text-center text-pitch-400">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const top = i < CUTOFF;
              const zebra = i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/10";
              const flash = flashIds.has(r.playerId);
              return (
                <tr key={r.playerId} className={`border-t border-slate-800/80 ${zebra} ${flash ? "animate-pulseRow" : ""}`}>
                  <td className="px-3 py-2.5">
                    <span className={`grid h-6 w-6 place-items-center rounded-md text-xs font-bold ${top ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-300"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <img src={initialsAvatar(r.name, r.avatar)} alt="" className="h-7 w-7 rounded-md" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.name}</span>
                        <Form form={r.form} />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-300">{r.mp}</td>
                  <td className="px-2 py-2.5 text-center text-slate-200">{r.w}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.d}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.l}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300">{r.gf}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.ga}</td>
                  <td className="px-2 py-2.5 text-center text-slate-200">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="px-2 py-2.5 text-center font-extrabold text-pitch-400">{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Form({ form }: { form: ("W"|"D"|"L")[] }) {
  if (!form.length) return null;
  return (
    <span className="hidden sm:inline-flex gap-0.5">
      {form.map((r, i) => (
        <span key={i} className={`grid h-4 w-4 place-items-center rounded text-[10px] font-bold text-white ${r === "W" ? "bg-pitch-600" : r === "D" ? "bg-slate-500" : "bg-red-600/80"}`}>{r}</span>
      ))}
    </span>
  );
}

function FixturesSection({ completed, upcoming }: { completed: MatchData[]; upcoming: MatchData[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FixtureList title="Played" matches={completed} />
      <FixtureList title="Upcoming" matches={upcoming} />
    </div>
  );
}

function FixtureList({ title, matches }: { title: string; matches: MatchData[] }) {
  const played = title === "Played";
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-lg">{played ? "Played" : "Upcoming"}</h2>
        <span className="text-xs text-slate-400">{matches.length}</span>
      </div>
      {matches.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No {played ? "completed" : "scheduled"} matches yet.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const homeG = m.homeGoals != null ? m.homeGoals : "—";
            const awayG = m.awayGoals != null ? m.awayGoals : "—";
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex flex-1 items-center justify-end gap-2 text-right">
                  <span className={`truncate ${homeG > awayG && played ? "font-bold text-slate-100" : "text-slate-300"}`}>{m.homePlayer.name}</span>
                  <img src={initialsAvatar(m.homePlayer.name, null)} alt="" className="h-6 w-6 rounded-md" />
                  <LegTag leg={m.leg} home />
                </div>
                <div className="flex flex-col items-center px-2">
                  {played ? (
                    <span className="grid min-w-[3rem] place-items-center rounded-lg bg-slate-950 px-2 py-1 text-lg font-extrabold tabular-nums">{homeG}:{awayG}</span>
                  ) : (
                    <span className="grid min-w-[3rem] place-items-center rounded-lg border border-slate-700 px-2 py-1 text-sm font-bold text-slate-400">vs</span>
                  )}
                </div>
                <LegTag leg={m.leg} home={false} />
                <img src={initialsAvatar(m.awayPlayer.name, null)} alt="" className="h-6 w-6 rounded-md" />
                <div className="flex flex-1 items-center gap-2">
                  <span className={`truncate ${awayG > homeG && played ? "font-bold text-slate-100" : "text-slate-300"}`}>{m.awayPlayer.name}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LegTag({ leg, home }: { leg: string; home: boolean }) {
  // leg is recorded from perspective of the lower-indexed player; show H for home player, A for away.
  const tag = home ? "H" : "A";
  return <span className="hidden sm:inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300" title={`${tag === "H" ? "Home" : "Away"} leg`}>{tag}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-56" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-slate-800/80">
                <td className="px-3 py-3"><div className="skeleton h-6 w-6" /></td>
                <td className="px-3 py-3"><div className="skeleton h-7 w-40" /></td>
                {Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-2 py-3"><div className="skeleton mx-auto h-4 w-6" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}