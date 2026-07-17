"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { initialsAvatar } from "@/lib/avatar";
import ConfirmDialog from "@/components/ConfirmDialog";

type Player = { id: string; name: string; avatar: string | null };
type Match = {
  id: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  leg: string;
  winnerOverride?: string | null;
  playedAt: string | null;
  homePlayer: { id: string; name: string; avatar: string | null };
  awayPlayer: { id: string; name: string; avatar: string | null };
};
type AuditLog = { id: string; actor: string; action: string; detail: string | null; createdAt: string };
type DataShape = { players: Player[]; matches: Match[]; leagueType?: "normal" | "tournament"; count: { players: number; matches: number } };
type LeagueOption = { id: string; name: string; type: "normal" | "tournament" };

export default function AdminPanel({ email, role }: { email: string; role: string }) {
  const [data, setData] = useState<DataShape | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<LeagueOption[]>([]);
  const [tab, setTab] = useState<"scores" | "players" | "leagues" | "audit">("scores");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{title:string;message:string;destructive?:boolean} | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const confirmAction = useCallback((title:string,msg:string,onOk:()=>void,destructive?:boolean) => {
    setDialog({title,message:msg,destructive});
    pendingRef.current = onOk;
  },[]);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ t: String(Date.now()) });
      if (selectedLeagueId) query.set("leagueId", selectedLeagueId);
      const res = await fetch(`/api/data?${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load league data (HTTP ${res.status})`);
      const json = await res.json() as DataShape;
      setData({ players: json.players, matches: json.matches, leagueType: json.leagueType, count: json.count });
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "Could not load league data");
    }
  }, [selectedLeagueId]);

  useEffect(() => { void load(); }, [load]);

  const loadLeagueOptions = useCallback(async () => {
    const res = await fetch("/api/leagues", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json() as { leagues: LeagueOption[] };
    setLeagueOptions(json.leagues);
  }, []);

  useEffect(() => { void loadLeagueOptions(); }, [loadLeagueOptions]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function apiOk(res: Response, okMsg: string) {
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    flash(okMsg);
    await load();
  }

  /** Optimistically patch a match in local state so the UI reflects the change instantly. */
  function patchMatch(id: string, patch: Partial<Match>) {
    setData((d) => d ? { ...d, matches: d.matches.map((m) => m.id === id ? { ...m, ...patch } : m) } : d);
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/auth", { method: "DELETE" });
    location.href = "/admin/login";
  }

  function handleDialogConfirm() {
    if (pendingRef.current) {
      pendingRef.current();
      pendingRef.current = null;
    }
  }

  function handleDialogCancel() {
    setDialog(null);
    pendingRef.current = null;
  }

  if (loadError && !data) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center text-sm text-red-300">
        <p>{loadError}</p>
        <button className="btn-ghost mt-4" onClick={() => void load()}>Retry</button>
</div>
  );
}

type LeagueData = { id: string; name: string; type: string; status: string; createdAt: string; _count: { players: number; matches: number } };

function LeaguesTab({ apiOk, onLeaguesChanged }: { apiOk: (res: Response, ok: string) => Promise<void>; onLeaguesChanged: () => Promise<void> }) {
  const [leagues, setLeagues] = useState<LeagueData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"normal" | "tournament">("normal");
  const [playerInput, setPlayerInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leagues", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { leagues: LeagueData[] };
      setLeagues(j.leagues);
      setErr(null);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Could not load leagues");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const players = playerInput.split("\n").map((p) => p.trim()).filter(Boolean);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (players.length < 2) return;
    setCreating(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, players }),
      });
      await apiOk(res, `Created ${type} league "${name.trim()}"`);
      await onLeaguesChanged();
      setName(""); setPlayerInput(""); setType("normal");
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not create league");
    } finally { setCreating(false); }
  }

  async function remove(l: LeagueData) {
    setDialog({title:'Delete league?',message:'Permanently delete this league and all its data?',destructive:true});
    pendingRef.current = async () => {
      setDialog(null);
      setDeleting(l.id);
      try {
        const res = await fetch(`/api/leagues/${l.id}`, { method: "DELETE" });
        await apiOk(res, `Deleted league "${l.name}"`);
      } catch (error: unknown) {
        alert(error instanceof Error ? error.message : "Could not delete league");
      } finally { setDeleting(null); }
    };
  }

  if (err) return <div className="card p-4 text-sm text-red-300">âš ï¸ {err}</div>;
  if (!leagues) return <div className="card p-4 text-sm text-slate-400">Loading leaguesâ€¦</div>;

  const knockoutLeagues = leagues.filter(l => l.type === 'tournament');

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="card divide-y divide-slate-800/70">
        {leagues.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-3">
            <span className={`grid h-7 w-7 place-items-center rounded-md text-xs font-bold ${l.type === "tournament" ? "bg-amber-500/20 text-amber-300" : "bg-pitch-600/20 text-pitch-300"}`}>
              {l.type === "tournament" ? "T" : "L"}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{l.name}</p>
              <p className="text-xs text-slate-500">
                {l.type === "tournament" ? "Tournament" : "Round-robin"} Â· {l._count.players} players Â· {l._count.matches} matches Â· {new Date(l.createdAt).toLocaleDateString()}
              </p>
            </div>
            <a href={`/?league=${l.id}`} className="btn-ghost !px-3 !py-1.5 text-xs" target="_blank" rel="noopener">View</a>
            <button className="btn-ghost !px-3 !py-1.5 text-xs text-red-300 hover:border-red-700" disabled={deleting === l.id} onClick={() => remove(l)}>Delete</button>
          </div>
        ))}
        {leagues.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No leagues yet. Create one on the right.</div>}
      </div>

      <form onSubmit={create} className="card h-fit space-y-3 p-4">
        <h2 className="font-bold">Create League</h2>
        <label className="block text-sm">
          <span className="text-slate-300">League Name</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <div>
          <span className="text-sm text-slate-300">League Type</span>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setType("normal")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${type === "normal" ? "border-pitch-500 bg-pitch-600/20 text-pitch-300" : "border-white/10 text-slate-300 hover:bg-slate-800"}`}>
              Round-Robin
            </button>
            <button type="button" onClick={() => setType("tournament")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${type === "tournament" ? "border-amber-500 bg-amber-600/20 text-amber-300" : "border-white/10 text-slate-300 hover:bg-slate-800"}`}>
              Tournament
            </button>
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-slate-300">Players (one per line)</span>
          <textarea className="input mt-1 min-h-[120px]" value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} placeholder={`Sam\nAlex\nJordan\nCasey`} />
          <p className="mt-1 text-xs text-slate-500">{players.length} player{players.length !== 1 ? "s" : ""} Â· min 2, max 64</p>
        </label>
        <button className="btn-primary w-full" disabled={creating || !name.trim() || players.length < 2}>
          {creating ? "Creatingâ€¦" : "Create League"}
        </button>
      </form>
    </div>
  );
}
  if (!data) return <div className="mx-auto max-w-3xl py-10 text-sm text-slate-400">Loading adminâ€¦</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Admin Panel</h1>
          <p className="text-sm text-slate-400">Signed in as <span className="text-slate-200">{email}</span> Â· <span className="badge">{role}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn-ghost text-xs">View dashboard</Link>
          <button className="btn-ghost text-xs" disabled={busy} onClick={logout}>Logout</button>
        </div>
      </div>

      <label className="block max-w-md text-sm">
        <span className="text-slate-300">Manage league</span>
        <select className="input mt-1" value={selectedLeagueId ?? ""} onChange={(event) => setSelectedLeagueId(event.target.value || null)}>
          <option value="">Default league</option>
          {leagueOptions.map((league) => <option key={league.id} value={league.id}>{league.name} ({league.type === "tournament" ? "Tournament" : "Round-robin"})</option>)}
        </select>
      </label>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
        {(["scores", "players", "leagues", "audit"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${tab === t ? "bg-pitch-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
            {t === "scores" ? "Fixtures & Scores" : t === "players" ? "Players" : t === "leagues" ? "Leagues" : "Audit Log"}
          </button>
        ))}
      </div>

      {toast && <div className="card border-pitch-700/60 bg-pitch-950/40 px-4 py-2 text-sm text-pitch-300">âœ“ {toast}</div>}

      {tab === "scores" && <ScoresTab data={data} apiOk={apiOk} patchMatch={patchMatch} setDialog={setDialog} pendingRef={pendingRef} />}
      {tab === "players" && <PlayersTab data={data} leagueId={selectedLeagueId} apiOk={apiOk} setDialog={setDialog} pendingRef={pendingRef} />}
      {tab === "leagues" && <LeaguesTab apiOk={apiOk} onLeaguesChanged={loadLeagueOptions} />}
      {tab === "audit" && <AuditTab />}
      <ConfirmDialog open={dialog!==null} title={dialog?.title??''} message={dialog?.message??''} destructive={dialog?.destructive} onConfirm={handleDialogConfirm} onCancel={handleDialogCancel} />
    </div>
  );
}

function ScoresTab({ data, apiOk, patchMatch, setDialog, pendingRef }: { data: DataShape; apiOk: (res: Response, ok: string) => Promise<void>; patchMatch: (id: string, patch: Partial<Match>) => void; setDialog: (d: any) => void; pendingRef: { current: (() => void) | null } }) {
  const PAGE_SIZE = 20;
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  const [winnerOverride, setWinnerOverride] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const homeScoreRef = useRef<HTMLInputElement>(null);
  const awayScoreRef = useRef<HTMLInputElement>(null);

  const matches = data.matches.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (q) {
      const s = (m.homePlayer.name + " " + m.awayPlayer.name).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleMatches = matches.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filter, q]);

  useEffect(() => {
    if (editId) homeScoreRef.current?.focus();
  }, [editId]);

  function startEdit(m: Match) {
    setEditId(m.id);
    setHg(m.homeGoals != null ? String(m.homeGoals) : "");
    setAg(m.awayGoals != null ? String(m.awayGoals) : "");
    setWinnerOverride(m.winnerOverride ?? "");
  }

  async function save(m: Match) {
    if (!/^\d+$/.test(hg) || !/^\d+$/.test(ag)) {
      return alert("Enter a non-negative whole number for both scores");
    }
    const h = Number(hg);
    const a = Number(ag);
    if (!Number.isSafeInteger(h) || !Number.isSafeInteger(a)) {
      return alert("Scores are too large");
    }
    setSaving(m.id);
    try {
      const res = await fetch(`/api/matches/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeGoals: h, awayGoals: a, ...(data.leagueType === "tournament" ? { winnerOverride: winnerOverride || null } : {}) }),
      });
      await apiOk(res, `Saved ${m.homePlayer.name} ${h}:${a} ${m.awayPlayer.name}`);
      patchMatch(m.id, { homeGoals: h, awayGoals: a, status: "completed", playedAt: m.playedAt ?? new Date().toISOString() });
      setEditId(null);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not save score");
    } finally { setSaving(null); }
  }

  async function reset(m: Match) {
    setDialog({title:'Reset score?',message:'Reset score for '+m.homePlayer.name+' vs '+m.awayPlayer.name+'?',destructive:true});
    pendingRef.current = async () => {
      setDialog(null);
      setSaving(m.id);
      try {
      const res = await fetch(`/api/matches/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: true, homeGoals: null, awayGoals: null, status: "scheduled" }),
      });
      await apiOk(res, `Reset ${m.homePlayer.name} vs ${m.awayPlayer.name}`);
      // Optimistically flip this match back to scheduled in the local UI immediately.
      patchMatch(m.id, { homeGoals: null, awayGoals: null, status: "scheduled", playedAt: null });
      if (editId === m.id) setEditId(null);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not reset score");
    } finally { setSaving(null); }
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <input className="input pr-9" placeholder="Search playersâ€¦" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white"
              onClick={() => setQ("")}
              aria-label="Clear player search"
            >
              Ã—
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
          {(["all", "scheduled", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-pitch-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{f}</button>
          ))}
        </div>
        <span className="ml-auto self-center text-xs text-slate-400">{matches.length} matches</span>
      </div>

      <div className="card divide-y divide-slate-800/70">
        {visibleMatches.map((m) => {
          const editing = editId === m.id;
          const played = m.status === "completed";
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex flex-1 items-center justify-end gap-2 text-right">
                <span className={`truncate ${played && (m.homeGoals ?? 0) > (m.awayGoals ?? 0) ? "font-bold" : "text-slate-300"}`}>{m.homePlayer.name}</span>
                <img src={initialsAvatar(m.homePlayer.name, m.homePlayer.avatar)} alt="" className="h-6 w-6 rounded-md" />
                <span className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 sm:inline">H</span>
              </div>
              <div className="flex items-center gap-1">
                {editing ? (
                  <>
                    <input
                      ref={homeScoreRef}
                      aria-label={`${m.homePlayer.name} score`}
                      className="input !w-14 !px-2 text-center text-base font-bold"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={hg}
                      onChange={(e) => setHg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          awayScoreRef.current?.focus();
                        }
                      }}
                    />
                    <span className="font-bold">:</span>
                    <input
                      ref={awayScoreRef}
                      aria-label={`${m.awayPlayer.name} score`}
                      className="input !w-14 !px-2 text-center text-base font-bold"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={ag}
                      onChange={(e) => setAg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void save(m);
                        }
                      }}
                    />
                    {data.leagueType === "tournament" && hg === ag && (
                      <select className="input !w-36 !px-2 text-xs" value={winnerOverride} onChange={(e) => setWinnerOverride(e.target.value)} aria-label="Draw winner">
                        <option value="">Select winner</option>
                        <option value={m.homePlayerId}>{m.homePlayer.name}</option>
                        <option value={m.awayPlayerId}>{m.awayPlayer.name}</option>
                      </select>
                    )}
                  </>
                ) : (
                  <span className={`grid min-w-[3rem] place-items-center rounded-lg px-2 py-1 text-base font-extrabold tabular-nums ${played ? "bg-slate-950" : "border border-slate-700 text-slate-500"}`}>
                    {played ? `${m.homeGoals}:${m.awayGoals}` : "vs"}
                  </span>
                )}
              </div>
              <div className="flex flex-1 items-center gap-2">
                <span className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 sm:inline">A</span>
                <img src={initialsAvatar(m.awayPlayer.name, m.awayPlayer.avatar)} alt="" className="h-6 w-6 rounded-md" />
                <span className={`truncate ${played && (m.awayGoals ?? 0) > (m.homeGoals ?? 0) ? "font-bold" : "text-slate-300"}`}>{m.awayPlayer.name}</span>
              </div>
              <div className="ml-auto flex gap-2">
                {editing ? (
                  <>
                    <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={saving === m.id} onClick={() => save(m)}>{saving === m.id ? "â€¦" : "Save"}</button>
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => startEdit(m)}>Edit</button>
                    {played && <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={saving === m.id} onClick={() => reset(m)}>Reset</button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {matches.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No matches match the filter.</div>}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <span>Page {safePage + 1} of {totalPages}</span>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>
            Next
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-slate-500">
        Tip: while editing, Enter moves to the away score; Enter again saves.
      </p>
    </div>
  );
}

function PlayersTab({ data, leagueId, apiOk, setDialog, pendingRef }: { data: DataShape; leagueId: string | null; apiOk: (res: Response, ok: string) => Promise<void>; setDialog: (d: any) => void; pendingRef: { current: (() => void) | null } }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Record<string, { name: string; avatar: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatar: avatar.trim() || null, leagueId }),
      });
      await apiOk(res, `Added ${name.trim()} (+fixtures auto-generated)`);
      setName(""); setAvatar("");
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not add player");
    } finally { setAdding(false); }
  }

  function startEdit(p: Player) {
    setEditing((s) => ({ ...s, [p.id]: { name: p.name, avatar: p.avatar ?? "" } }));
  }

  async function saveEdit(p: Player) {
    const ed = editing[p.id];
    if (!ed || !ed.name.trim()) return;
    setSaving(p.id);
    try {
      const res = await fetch(`/api/players/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ed.name.trim(), avatar: ed.avatar.trim() || null }),
      });
      await apiOk(res, `Updated ${ed.name.trim()}`);
      setEditing((s) => { const c = { ...s }; delete c[p.id]; return c; });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not update player");
    } finally { setSaving(null); }
  }

  async function remove(p: Player) {
    setDialog({title:'Delete player?',message:'Delete '+p.name+'? Removes all fixtures and standings data.',destructive:true});
    pendingRef.current = async () => {
      setDialog(null);
      setSaving(p.id);
      try {
        const res = await fetch(`/api/players/${p.id}`, { method: "DELETE" });
        await apiOk(res, `Deleted ${p.name}`);
      } catch (error: unknown) {
        alert(error instanceof Error ? error.message : "Could not delete player");
      } finally { setSaving(null); }
    };
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card divide-y divide-slate-800/70">
        {data.players.map((p, i) => {
          const ed = editing[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-800 text-xs font-bold text-slate-300">{i + 1}</span>
              <img src={initialsAvatar(p.name, p.avatar)} alt="" className="h-8 w-8 rounded-md" />
              {ed ? (
                <>
                  <input className="input !py-1.5 max-w-[180px]" value={ed.name} onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...s[p.id], name: e.target.value } }))} />
                  <input className="input !py-1.5 max-w-[140px]" placeholder="avatar URL" value={ed.avatar} onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...s[p.id], avatar: e.target.value } }))} />
                  <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={saving === p.id} onClick={() => saveEdit(p)}>Save</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditing((s) => { const c = { ...s }; delete c[p.id]; return c; })}>Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-semibold">{p.name}</p>
                    {p.avatar && <p className="text-xs text-slate-500 truncate">{p.avatar}</p>}
                  </div>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs text-red-300 hover:border-red-700" disabled={saving === p.id} onClick={() => remove(p)}>Delete</button>
                </>
              )}
            </div>
          );
        })}
        {data.players.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No players yet. Add one to auto-generate fixtures.</div>}
      </div>

      <form onSubmit={add} className="card h-fit space-y-3 p-4">
        <h2 className="font-bold">Add player</h2>
        <p className="text-xs text-slate-400">Fixtures (home & away legs vs every existing player) are auto-generated.</p>
        <label className="block text-sm">
          <span className="text-slate-300">Name</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Avatar URL (optional)</span>
          <input className="input mt-1" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://â€¦" />
        </label>
        <button className="btn-primary w-full" disabled={adding}>{adding ? "Addingâ€¦" : "Add player"}</button>
      </form>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/audit", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        setLogs(j.logs);
      } catch (error: unknown) {
        setErr(error instanceof Error ? error.message : "Could not load audit log");
      }
    })();
  }, []);
  if (err) return <div className="card p-4 text-sm text-red-300">âš ï¸ {err}</div>;
  if (!logs) return <div className="card p-4 text-sm text-slate-400">Loading audit logâ€¦</div>;
  if (logs.length === 0) return <div className="card p-6 text-center text-sm text-slate-500">No actions logged yet.</div>;
  return (
    <div className="card divide-y divide-slate-800/70">
      {logs.map((l) => (
        <div key={l.id} className="flex items-start gap-3 p-3">
          <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-slate-800 text-xs">ðŸ“</span>
          <div className="flex-1">
            <p className="text-sm"><span className="font-semibold text-pitch-400">{l.action}</span> <span className="text-slate-400">by {l.actor}</span></p>
            {l.detail && <p className="text-sm text-slate-300">{l.detail}</p>}
            <p className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}













