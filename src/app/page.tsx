import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-slate-400">Loading league…</div>}>
      <Dashboard />
    </Suspense>
  );
}