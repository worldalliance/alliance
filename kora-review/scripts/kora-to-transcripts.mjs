#!/usr/bin/env bun
// Converts KORA's pair export into transcript upload lines, one JSON object per line. The server runs the
// same conversion on upload; this is for checking a file by hand.
//
//   bun scripts/kora-to-transcripts.mjs pairs.jsonl > transcripts.jsonl
import { readFileSync } from "node:fs";
import { fromKoraPair, readKoraPairs } from "../src/convert.ts";

const file = process.argv[2];
if (!file) {
  console.error(
    "Usage: bun scripts/kora-to-transcripts.mjs <pairs.jsonl|pairs.json>",
  );
  process.exit(2);
}
for (const r of readKoraPairs(readFileSync(file, "utf8"))) {
  if (!r.ok) {
    console.error(`Line ${r.line}: ${r.error}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(fromKoraPair(r.record)) + "\n");
}
