"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** In-page tab bar for a product's sections — keeps the left sidebar constant. */
export default function ProductTabs({ id, name }: { id: string; name?: string }) {
  const path = usePathname() || "";
  const base = `/product/${id}`;
  const tabs = [
    { href: base, label: "Overview", on: path === base },
    { href: `${base}/agents`, label: "Agents", on: path.startsWith(`${base}/agents`) },
    { href: `${base}/backlog`, label: "Backlog", on: path.startsWith(`${base}/backlog`) },
    { href: `${base}/discovery`, label: "Discovery", on: path.startsWith(`${base}/discovery`) },
  ];
  return (
    <div className="ptabs-wrap">
      <div className="crumb" style={{ marginBottom: 8 }}>
        <Link href="/products">Products</Link> / {name || "Product"}
      </div>
      <div className="ptabs">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`ptab ${t.on ? "on" : ""}`}>{t.label}</Link>
        ))}
      </div>
    </div>
  );
}
