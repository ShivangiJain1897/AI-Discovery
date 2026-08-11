"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { IntakeStatus } from "@/lib/intake/types";
import { INTAKE_STATUSES } from "@/lib/intake/types";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  INTAKE_STATUSES.map((s) => [s.id, s.label])
);

export function StatusPill({ status }: { status: IntakeStatus }) {
  return <span className={`status ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function TopBar({ mode }: { mode?: "live" | "demo" }) {
  const pathname = usePathname() || "/";
  const onIntake = pathname.startsWith("/intake");
  const onStudio = pathname.startsWith("/studio");
  const onDiscovery = !onIntake && !onStudio;
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">◈</span>
          <span>
            AI Discovery
            <small>Discover · Intake · Track</small>
          </span>
        </Link>
        <nav className="topnav">
          <Link href="/" className={`topnav-link ${onDiscovery ? "on" : ""}`}>
            Discovery
          </Link>
          <Link href="/intake" className={`topnav-link ${onIntake ? "on" : ""}`}>
            Intake
          </Link>
          <Link href="/studio" className={`topnav-link ${onStudio ? "on" : ""}`}>
            Studio
          </Link>
        </nav>
        <span className="spacer" />
        {mode && (
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "Illustrative demo output"}>
            <span className="dot" />
            {mode === "live" ? "Live · Claude" : "Demo mode"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Persisted "who am I" for attribution on the intake tracker (no auth in pilot). */
export function useCurrentUser(): [string, (n: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(localStorage.getItem("aid_user") || "");
  }, []);
  const update = (n: string) => {
    setName(n);
    localStorage.setItem("aid_user", n);
  };
  return [name, update];
}
