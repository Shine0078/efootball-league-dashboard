import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "eFootball League Dashboard",
  description: "Private friends eFootball round-robin league standings & fixtures",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-pitch-600 text-lg">⚽</span>
              <span className="text-lg">eFootball <span className="text-pitch-400">League</span></span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-slate-800 text-slate-300">Standings</Link>
              <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-slate-800 text-slate-300">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-slate-500">
          eFootball League Dashboard · private friends league
        </footer>
      </body>
    </html>
  );
}