"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePins } from "./shared";

interface SessionLite {
  id: string;
  input: { text: string };
  createdAt: number;
}

/**
 * App shell: a collapsible left sidebar (the pattern every chat/AI + product tool
 * converges on) with a prominent New action, pinned items, primary nav, a recent
 * history list, and secondary items in an overflow ("More") menu.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [recent, setRecent] = useState<SessionLite[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pins, toggle } = usePins();

  useEffect(() => {
    setCollapsed(localStorage.getItem("aid_sidebar_collapsed") === "1");
  }, []);
  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
  }, []);
  // Refresh recent history on navigation.
  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((d) => setRecent(Array.isArray(d.sessions) ? d.sessions.slice(0, 12) : []))
      .catch(() => {});
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("aid_sidebar_collapsed", next ? "1" : "0");
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Mobile top bar */}
      <div className="mtop">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/" className="mbrand"><span className="logo-mark sm">◈</span> AI Discovery</Link>
      </div>

      <div className="scrim" onClick={() => setMobileOpen(false)} />

      <aside className="sidebar">
        <div className="sb-top">
          <button className="icon-btn" onClick={toggleCollapsed} aria-label="Toggle sidebar">☰</button>
          {!collapsed && (
            <Link href="/" className="sb-brand">
              <span className="logo-mark sm">◈</span>
              <span>AI Discovery</span>
            </Link>
          )}
        </div>

        <button className="sb-new" onClick={() => router.push("/")} title="New discovery">
          <span className="plus">＋</span>
          {!collapsed && <span>New discovery</span>}
        </button>


        {/* Pinned */}
        {pins.length > 0 && (
          <div className="sb-section">
            {!collapsed && <div className="sb-heading">Pinned</div>}
            {pins.map((p) => (
              <div key={p.id} className={`sb-item ${pathname === p.href ? "on" : ""}`}>
                <Link href={p.href} className="sb-item-link" title={p.label}>
                  <span className="sb-ico">{p.kind === "usecase" ? "◷" : "✦"}</span>
                  {!collapsed && <span className="sb-item-label">{p.label}</span>}
                </Link>
                {!collapsed && (
                  <button className="sb-x" title="Unpin" onClick={() => toggle(p)}>★</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recent history (chat-like) */}
        {!collapsed && (
          <div className="sb-section sb-recent">
            <div className="sb-heading">Recent</div>
            {recent.length === 0 ? (
              <div className="sb-empty">No discoveries yet</div>
            ) : (
              recent.map((s) => (
                <Link key={s.id} href={`/session/${s.id}`} className={`sb-item-link recent ${pathname === `/session/${s.id}` ? "on" : ""}`} title={firstLine(s.input.text)}>
                  <span className="sb-ico">✦</span>
                  <span className="sb-item-label">{firstLine(s.input.text)}</span>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Footer: mode + More (overflow) */}
        <div className="sb-footer">
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "Illustrative demo output"}>
            <span className="dot" />{!collapsed && (mode === "live" ? "Live · Claude" : "Demo mode")}
          </span>
          <div className="more-wrap">
            <button className="icon-btn" onClick={() => setMoreOpen((v) => !v)} aria-label="More" title="More">⋯</button>
            {moreOpen && (
              <>
                <div className="more-scrim" onClick={() => setMoreOpen(false)} />
                <div className="more-menu">
                  <Link href="/studio" className="more-item" onClick={() => setMoreOpen(false)}>⚙ Studio — edit agent prompts</Link>
                  <a href="https://github.com/ShivangiJain1897/AI-Discovery/blob/claude/ai-discovery-payer-platform-tjx1ri/DEPLOY.md" target="_blank" rel="noopener noreferrer" className="more-item">🚀 Deploy guide</a>
                  <a href="https://github.com/ShivangiJain1897/AI-Discovery/tree/claude/ai-discovery-payer-platform-tjx1ri" target="_blank" rel="noopener noreferrer" className="more-item">‹ › View code</a>
                </div>
              </>
            )}
          </div>
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
