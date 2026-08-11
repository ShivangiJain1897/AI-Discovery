import Link from "next/link";

export function TopBar({ mode }: { mode?: "live" | "demo" }) {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">◈</span>
          <span>
            AI Discovery
            <small>Paste anything · pick what you need</small>
          </span>
        </Link>
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
