import Link from "next/link";
import type { AgentId } from "@/lib/agents/types";

export const AGENT_EMOJI: Record<AgentId, string> = {
  domain: "🧭",
  defect: "🐞",
  market: "📈",
  process: "⚙️",
};

export const AGENT_LABEL: Record<AgentId, string> = {
  domain: "Domain",
  defect: "Defect",
  market: "Market",
  process: "Process",
};

export function TopBar({ mode }: { mode?: "live" | "demo" }) {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">◈</span>
          <span>
            AI Discovery
            <small>Payer · Member Value Chain</small>
          </span>
        </Link>
        <span className="spacer" />
        {mode && (
          <span className={`badge ${mode}`} title={mode === "live" ? "Powered by Claude" : "Deterministic seed data"}>
            <span className="dot" />
            {mode === "live" ? "Live · Claude" : "Demo mode"}
          </span>
        )}
      </div>
    </div>
  );
}

export function Meter({ value, max = 5, kind }: { value: number; max?: number; kind?: "effort" }) {
  return (
    <span className={`meter ${kind ?? ""}`}>
      {Array.from({ length: max }).map((_, i) => (
        <i key={i} className={i < value ? "on" : ""} />
      ))}
    </span>
  );
}
