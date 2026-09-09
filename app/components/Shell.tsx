"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface SessionLite { id: string; input: string; inputType: string; objective: string; stage: string }

/** Constant sidebar: start a new session, and return to earlier ones. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [history, setHistory] = useState<SessionLite[]>([]);

  useEffect(() => { setCollapsed(localStorage.getItem("pio_collapsed") === "1"); }, []);
  useEffect(() => { fetch("/api/catalog").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {}); }, []);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d.sessions) ? d.sessions.slice(0, 25) : []))
      .catch(() => {});
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const n = !collapsed;
    setCollapsed(n);
    localStorage.setItem("pio_collapsed", n ? "1" : "0");
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="mtop">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/" className="mbrand"><span className="logo-mark sm">◈</span> Orchestrator</Link>
      </div>
      <div className="scrim" onClick={() => setMobileOpen(false)} />

      <aside className="sidebar">
        <div className="sb-top">
          <button className="icon-btn" onClick={toggleCollapsed} aria-label="Toggle sidebar">☰</button>
          {!collapsed && (
            <Link href="/" className="sb-brand">
              <span className="logo-mark sm">◈</span>
              <span>Orchestrator</span>
            </Link>
          )}
        </div>

        <button className="sb-new" onClick={() => router.push("/")} title="New session">
          <span className="plus">＋</span>{!collapsed && <span>New question</span>}
        </button>

        {!collapsed && (
          <div className="sb-section sb-recent">
            <div className="sb-heading">Sessions</div>
            {history.length === 0 ? (
              <div className="sb-empty">Nothing yet</div>
            ) : (
              history.map((h) => (
                <Link
                  key={h.id}
                  href={`/s/${h.id}`}
                  className={`sb-item-link recent ${pathname === `/s/${h.id}` ? "on" : ""}`}
                  title={h.objective || h.input}
                >
                  <span className="sb-ico">✦</span>
                  <span className="sb-item-label">{firstLine(h.input)}</span>
                </Link>
              ))
            )}
          </div>
        )}

        <div className="sb-footer">
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "No API key — evidence gaps are reported, nothing is invented"}>
            <span className="dot" />{!collapsed && (mode === "live" ? "Live · Claude" : "Demo mode")}
          </span>
        </div>
      </aside>

      <div className="app-main">{children}</div>
    </div>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Untitled";
  return l.length > 34 ? l.slice(0, 31) + "…" : l;
}
