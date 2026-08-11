import { NextResponse } from "next/server";
import { getEffectivePrompt, resetOverride, saveOverride } from "@/lib/capabilities/prompt-store";
import { DEFAULT_PROMPTS } from "@/lib/capabilities/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/prompts/:id — save an edited prompt (override). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DEFAULT_PROMPTS[id]) return NextResponse.json({ error: "Unknown capability" }, { status: 404 });
  let body: { system?: string; task?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const system = (body.system ?? "").trim();
  const task = (body.task ?? "").trim();
  if (!system || !task) return NextResponse.json({ error: "system and task are required" }, { status: 400 });
  await saveOverride(id, system, task);
  return NextResponse.json({ prompt: await getEffectivePrompt(id), isModified: true });
}

/** DELETE /api/prompts/:id — reset to the default prompt. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DEFAULT_PROMPTS[id]) return NextResponse.json({ error: "Unknown capability" }, { status: 404 });
  await resetOverride(id);
  return NextResponse.json({ prompt: await getEffectivePrompt(id), isModified: false });
}
