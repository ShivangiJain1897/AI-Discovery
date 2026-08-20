"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface ProductLite {
  id: string;
  name: string;
  oneLiner: string;
}

const SECTIONS = [
  { key: "", label: "Overview", icon: "◫" },
  { key: "agents", label: "Agents", icon: "🤖" },
  { key: "discovery", label: "Discovery", icon: "✦" },
  { key: "backlog", label: "Backlog", icon: "◧" },
];

/** Product Studio shell: a product switcher + per-product sections. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const currentId = pathname.match(/^\/product\/([^/]+)/)?.[1];
  const current = products.find((p) => p.id === currentId);

  useEffect(() => { setCollapsed(localStorage.getItem("aid_sidebar_collapsed") === "1"); }, []);
  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d.products) ? d.products : [])).catch(() => {});
    fetch("/api/product-agents").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
  }, []);
  useEffect(() => { setMobileOpen(false); setSwitcherOpen(false); }, [pathname]);

  function toggleCollapsed() {
    const n = !collapsed; setCollapsed(n); localStorage.setItem("aid_sidebar_collapsed", n ? "1" : "0");
  }
  const sectionActive = (key: string) => {
    if (!currentId) return false;
    const base = `/product/${currentId}`;
    return key === "" ? pathname === base : pathname.startsWith(`${base}/${key}`);
  };

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

        {/* Product switcher */}
        {!collapsed && (
          <div className="switcher">
            <button className="switcher-btn" onClick={() => setSwitcherOpen((v) => !v)}>
              <span className="sw-ico">◱</span>
              <span className="sw-name">{current ? current.name : "All products"}</span>
              <span className="sw-caret">⌄</span>
            </button>
            {switcherOpen && (
              <>
                <div className="more-scrim" onClick={() => setSwitcherOpen(false)} />
                <div className="switcher-menu">
                  <Link href="/" className="sw-item">All products</Link>
                  {products.map((p) => (
                    <Link key={p.id} href={`/product/${p.id}`} className={`sw-item ${p.id === currentId ? "on" : ""}`}>
                      <span className="sw-dot" />{p.name}
                    </Link>
                  ))}
                  <button className="sw-item new" onClick={() => { setSwitcherOpen(false); router.push("/product/new"); }}>＋ New product</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Per-product sections */}
        {currentId ? (
          <nav className="sb-nav">
            {SECTIONS.map((s) => (
              <Link key={s.key} href={`/product/${currentId}${s.key ? "/" + s.key : ""}`}
                className={`sb-navlink ${sectionActive(s.key) ? "on" : ""}`} title={s.label}>
                <span className="sb-ico">{s.icon}</span>{!collapsed && <span>{s.label}</span>}
              </Link>
            ))}
          </nav>
        ) : (
          <button className="sb-new" onClick={() => router.push("/product/new")} title="New product">
            <span className="plus">＋</span>{!collapsed && <span>New product</span>}
          </button>
        )}

        {/* Product list (when none selected) */}
        {!currentId && !collapsed && (
          <div className="sb-section sb-recent">
            <div className="sb-heading">Products</div>
            {products.length === 0 ? <div className="sb-empty">None yet</div> :
              products.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="sb-item-link recent" title={p.oneLiner}>
                  <span className="sb-ico">◱</span><span className="sb-item-label">{p.name}</span>
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
