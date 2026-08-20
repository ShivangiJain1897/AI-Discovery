"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SessionLite {
  id: string;
  input: { text: string };
}

/**
 * Constant app shell. The left nav never restructures based on selection:
 * Discovery (the front door), Products, and Studio (in the ⋯ menu) are always
 * in the same place. Product sub-navigation lives as tabs inside the product
 * page, not in this sidebar.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [recent, setRecent] = useState<SessionLite[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setCollapsed(localStorage.getItem("aid_sidebar_collapsed") === "1"); }, []);
  useEffect(() => {
    fetch("/api/product-agents").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/analyze").then((r) => r.json()).then((d) => setRecent(Array.isArray(d.sessions) ? d.sessions.slice(0, 10) : [])).catch(() => {});
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const n = !collapsed; setCollapsed(n); localStorage.setItem("aid_sidebar_collapsed", n ? "1" : "0");
  }

  const onDashboard = pathname === "/";
  const onDiscovery = pathname.startsWith("/discovery") || pathname.startsWith("/session");
  const onProducts = pathname.startsWith("/products") || pathname.startsWith("/product/");

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="mtop">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/" className="mbrand"><span className="logo-mark sm">◈</span> Product Studio</Link>
      </div>
      <div className="scrim" onClick={() => setMobileOpen(false)} />

      <aside className="sidebar">
        <div className="sb-top">
          <button className="icon-btn" onClick={toggleCollapsed} aria-label="Toggle sidebar">☰</button>
          {!collapsed && (
            <Link href="/" className="sb-brand">
              <span className="logo-mark sm">◈</span><span>Product Studio</span>
            </Link>
          )}
        </div>

        <nav className="sb-nav" style={{ marginTop: 8 }}>
          <Link href="/" className={`sb-navlink ${onDashboard ? "on" : ""}`} title="Dashboard">
            <span className="sb-ico">◫</span>{!collapsed && <span>Dashboard</span>}
          </Link>
          <Link href="/discovery" className={`sb-navlink ${onDiscovery ? "on" : ""}`} title="Discovery">
            <span className="sb-ico">✦</span>{!collapsed && <span>Discovery</span>}
          </Link>
          <Link href="/products" className={`sb-navlink ${onProducts ? "on" : ""}`} title="Products">
            <span className="sb-ico">◱</span>{!collapsed && <span>Products</span>}
          </Link>
        </nav>

        {!collapsed && (
          <div className="sb-section sb-recent">
            <div className="sb-heading">Recent discoveries</div>
            {recent.length === 0 ? <div className="sb-empty">None yet</div> :
              recent.map((s) => (
                <Link key={s.id} href={`/session/${s.id}`} className={`sb-item-link recent ${pathname === `/session/${s.id}` ? "on" : ""}`} title={firstLine(s.input.text)}>
                  <span className="sb-ico">✦</span><span className="sb-item-label">{firstLine(s.input.text)}</span>
                </Link>
              ))}
          </div>
        )}

        <div className="sb-footer">
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "Deterministic demo output"}>
            <span className="dot" />{!collapsed && (mode === "live" ? "Live · Claude" : "Demo mode")}
          </span>
          <div className="more-wrap">
            <button className="icon-btn" onClick={() => setMoreOpen((v) => !v)} aria-label="More">⋯</button>
            {moreOpen && (
              <>
                <div className="more-scrim" onClick={() => setMoreOpen(false)} />
                <div className="more-menu">
                  <Link href="/studio" className="more-item" onClick={() => setMoreOpen(false)}>⚙ Studio — edit agent prompts</Link>
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
