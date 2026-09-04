import { NextResponse } from "next/server";
import { getProvider } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — truthful diagnostic of the live AI path.
 *
 * Unlike the "Live · Claude" badge (which only checks that a key EXISTS), this
 * actually makes a tiny call to Claude and reports whether it succeeds. If the
 * key is missing or invalid, the app silently falls back to demo output — this
 * endpoint is how you tell the difference.
 */
export async function GET() {
  const keyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const provider = await getProvider();

  const result: {
    keyPresent: boolean;
    mode: "live" | "demo";
    model: string;
    liveCallOk: boolean | null;
    claudeSaid?: unknown;
    error?: string;
    verdict: string;
  } = {
    keyPresent,
    mode: provider.mode,
    model,
    liveCallOk: null,
    verdict: "",
  };

  if (provider.mode !== "live") {
    result.verdict =
      "DEMO MODE — no ANTHROPIC_API_KEY detected. Output is deterministic seed text, not Claude. Set ANTHROPIC_API_KEY in Vercel and redeploy.";
    return NextResponse.json(result);
  }

  try {
    const r = await provider.generateJson<{ ok?: boolean }>({
      system: "You are a health check. Reply with JSON only.",
      prompt: 'Return exactly {"ok": true}',
      maxTokens: 50,
    });
    result.liveCallOk = true;
    result.claudeSaid = r;
    result.verdict = "LIVE OK — Claude responded. Real AI output is working.";
  } catch (e) {
    result.liveCallOk = false;
    result.error = e instanceof Error ? e.message : String(e);
    result.verdict =
      "KEY PRESENT BUT CALL FAILED — the badge may say 'Live', but every agent call is failing and falling back to demo text. Fix the key (create a fresh one), set ANTHROPIC_API_KEY in Vercel, and redeploy. See 'error' above.";
  }

  return NextResponse.json(result);
}
