/**
 * Tests for reading JSON out of model output.
 *
 * This is the code path that broke in production: every research lens failed
 * with "No JSON found in model output" because responses were arriving cut off
 * at the token limit, and a truncated object never balances its braces. These
 * cases pin the recovery behaviour so that can't come back silently.
 *
 *   npm test
 */
import { extractJson, EmptyOutputError, TruncatedOutputError } from "../lib/llm/provider.ts";

let pass = 0;
let fail = 0;

function ok(name: string, input: string, check: (v: any) => boolean) {
  try {
    const out = extractJson<any>(input);
    if (check(out)) { console.log("  ✓", name); pass++; }
    else { console.log("  ✗", name, "— parsed, but not as expected:", JSON.stringify(out).slice(0, 140)); fail++; }
  } catch (e) {
    console.log("  ✗", name, "—", (e as Error).name + ":", (e as Error).message.slice(0, 100));
    fail++;
  }
}

function throws(name: string, input: string, expected: string) {
  try {
    extractJson(input);
    console.log("  ✗", name, "— should have thrown");
    fail++;
  } catch (e) {
    const n = (e as Error).name;
    if (n === expected) { console.log("  ✓", name, "→ throws", n); pass++; }
    else { console.log("  ✗", name, "— threw", n, "expected", expected); fail++; }
  }
}

console.log("\nWell-formed output");
ok("bare JSON", '{"summary":"ok","findings":[]}', (o) => o.summary === "ok");
ok("prose preamble before the JSON", 'Here you go:\n{"summary":"ok"}', (o) => o.summary === "ok");
ok("markdown fence", '```json\n{"summary":"ok"}\n```', (o) => o.summary === "ok");
ok("braces inside a string", '{"summary":"use {curly} braces"}', (o) => o.summary === "use {curly} braces");
ok("escaped quotes inside a string", '{"summary":"they said \\"hi\\""}', (o) => o.summary === 'they said "hi"');
ok("brackets inside a string", '{"summary":"an [array] of things"}', (o) => o.summary === "an [array] of things");

console.log("\nCut off at the token limit — salvage what finished");
ok(
  "mid-object in a list: drops the partial item, keeps the complete ones",
  '{"summary":"s","findings":[{"title":"A","detail":"d1","confidence":"Low","basis":"b"},{"title":"B","detail":"d2","confidence":"High","basis":"b"},{"title":"C","deta',
  (o) => o.findings.length === 2 && o.findings[1].title === "B"
);
ok(
  "immediately after a complete item and its comma",
  '{"summary":"s","findings":[{"title":"A","detail":"d","confidence":"Low","basis":"b"},',
  (o) => o.findings.length === 1 && o.findings[0].title === "A"
);
ok(
  "mid-value in the root object: keeps the fields already finished",
  '{"summary":"members struggle to compare cost","industry":"Healthcare","users":"members who are trying to bud',
  (o) => o.summary === "members struggle to compare cost" && o.industry === "Healthcare"
);
ok(
  "deeply nested",
  '{"a":{"b":{"c":[1,2,3],"d":"x"},"e":[{"f":"g"},{"f":"h"},{"f":',
  (o) => o.a.b.c.length === 3 && o.a.e.length === 2
);
ok(
  "cut off inside a string containing a brace",
  '{"gaps":["check the {billing} system"],"findings":[{"title":"A","detail":"d","confidence":"Low","basis":"b"},{"title":"tru',
  (o) => o.findings.length === 1 && o.gaps[0] === "check the {billing} system"
);
ok("truncated array at the top level", '[{"a":1},{"a":2},{"a', (o) => o.length === 2);

console.log("\nNothing usable — must fail loudly so the caller retries");
throws("no text at all", "", "EmptyOutputError");
throws("only whitespace", "   \n  ", "EmptyOutputError");
throws("cut off before a single field finished", '{"summary":"the users here are strug', "TruncatedOutputError");
throws("prose with no JSON in it", "I can't help with that request.", "Error");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
