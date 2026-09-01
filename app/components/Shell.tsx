"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface WfLite { id: string; input: string; inputType: string }

/** Constant sidebar: New, and a history of discovery workflows. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [history, setHistory] = useState<WfLite[]>([]);

  useEffect(() => { setCollapsed(localStorage.getItem("wf_collapsed") === "1"); }, []);
  useEffect(() => { fetch("/api/agents").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {}); }, []);
  useEffect(() => {
    fetch("/api/workflow").then((r) => r.json()).then((d) => setHistory(Array.isArray(d.workflows) ? d.workflows.slice(0, 20) : [])).catch(() => {});
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() { const n = !collapsed; setCollapsed(n); localStorage.setItem("wf_collapsed", n ? "1" : "0"); }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="mtop">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/" className="mbrand"><span className="logo-mark sm">◈</span> Discovery Studio</Link>
      </div>
      <div className="scrim" onClick={() => setMobileOpen(false)} />

      <aside className="sidebar">
        <div className="sb-top">
          <button className="icon-btn" onClick={toggleCollapsed} aria-label="Toggle sidebar">☰</button>
          {!collapsed && (
            <Link href="/" className="sb-brand"><span className="logo-mark sm">◈</span><span>Discovery Studio</span></Link>
          )}
        </div>

        <button className="sb-new" onClick={() => router.push("/")} title="New discovery">
          <span className="plus">＋</span>{!collapsed && <span>New discovery</span>}
        </button>

        {!collapsed && (
          <div className="sb-section sb-recent">
            <div className="sb-heading">History</div>
            {history.length === 0 ? <div className="sb-empty">Nothing yet</div> :
              history.map((w) => (
                <Link key={w.id} href={`/w/${w.id}`} className={`sb-item-link recent ${pathname === `/w/${w.id}` ? "on" : ""}`} title={w.input}>
                  <span className="sb-ico">✦</span><span className="sb-item-label">{firstLine(w.input)}</span>
                </Link>
              ))}
          </div>
        )}

        <div className="sb-footer">
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "Deterministic demo output"}>
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
