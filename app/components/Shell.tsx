"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Item { id: string; idea: string; kind: string }

/** A slim sidebar: start something new, or go back to an earlier discovery. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/discovery")
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d.discoveries) ? d.discoveries.slice(0, 25) : []))
      .catch(() => {});
    setOpen(false);
  }, [pathname]);

  return (
    <div className={`shell ${open ? "open" : ""}`}>
      <div className="mobile-top">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/" className="brand-sm"><span className="mark">◈</span> AI Discovery</Link>
      </div>
      <div className="scrim" onClick={() => setOpen(false)} />

      <aside className="sidebar">
        <Link href="/" className="brand"><span className="mark">◈</span> AI Discovery</Link>

        <button className="new-btn" onClick={() => router.push("/")} type="button">
          <span>＋</span> New discovery
        </button>

        <div className="history">
          <div className="history-head">Recent</div>
          {history.length === 0 ? (
            <div className="history-empty">Nothing yet</div>
          ) : (
            history.map((h) => (
              <Link
                key={h.id}
                href={`/d/${h.id}`}
                className={`history-item ${pathname === `/d/${h.id}` ? "on" : ""}`}
                title={h.idea}
              >
                {firstLine(h.idea)}
              </Link>
            ))
          )}
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Untitled";
  return l.length > 40 ? l.slice(0, 37) + "…" : l;
}
