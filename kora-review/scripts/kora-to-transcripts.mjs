#!/usr/bin/env node
// Converts KORA's pair export (Annex B format: pair_id, risk_id, conversation_a/b with child/ai turns) into
// transcript upload lines that validate against transcriptSchema. Model names and fields the schema doesn't
// name (comprehension_options, feedback_text, note, risk_category_id, ...) are dropped.
//
//   node scripts/kora-to-transcripts.mjs pairs.jsonl > transcripts.jsonl
//
// Accepts JSON Lines, or a JSON array (including an array split one element per line).
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/kora-to-transcripts.mjs <pairs.jsonl|pairs.json>"); process.exit(2); }
const text = readFileSync(file, "utf8").trim();

let records;
try { records = JSON.parse(text); }
catch { records = text.split("\n").filter(l => l.trim()).map((l, i) => { try { return JSON.parse(l.replace(/,\s*$/, "")); } catch (e) { throw new Error(`Line ${i + 1}: ${e.message}`); } }); }
if (!Array.isArray(records)) records = [records];

const turns = list => list.map(m => ({ role: m.role === "ai" ? "ai" : "child", text: String(m.text ?? "") }));
const seen = new Set();
for (const p of records) {
  if (seen.has(p.pair_id)) throw new Error(`Duplicate pair_id ${p.pair_id}`);
  seen.add(p.pair_id);
  const t = {
    transcriptId: String(p.pair_id),
    category: p.risk_id,
    ...(p.pair_type ? { pairType: String(p.pair_type) } : {}),
    scenarioTitle: String(p.scenario_title ?? p.pair_id),
    childAge: Number(p.child_age),
    ...(p.age_band ? { ageBand: String(p.age_band) } : {}),
    ...(p.child_background ? { childBackground: String(p.child_background) } : {}),
    ...(p.scenario ? { scenario: String(p.scenario) } : {}),
    conversationA: turns(p.conversation_a ?? []),
    conversationB: turns(p.conversation_b ?? []),
  };
  process.stdout.write(JSON.stringify(t) + "\n");
}
