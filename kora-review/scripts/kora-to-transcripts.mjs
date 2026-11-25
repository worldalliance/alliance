#!/usr/bin/env bun
// Converts KORA's transcript export into transcript upload lines, one JSON object per line. The server runs the
// same conversion on upload; this is for checking a file by hand.
//
//   bun scripts/kora-to-transcripts.mjs pairs.yaml > transcripts.jsonl
import { readFileSync } from "node:fs";
import { fromKoraConversation, readKoraConversations } from "../src/convert.ts";

const file = process.argv[2];
if (!file) {
  console.error(
    "Usage: bun scripts/kora-to-transcripts.mjs <pairs.jsonl|pairs.json|pairs.yaml>",
  );
  process.exit(2);
}
for (const r of readKoraConversations(readFileSync(file, "utf8"))) {
  if (!r.ok) {
    console.error(`Line ${r.line}: ${r.error}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(fromKoraConversation(r.record)) + "\n");
}
