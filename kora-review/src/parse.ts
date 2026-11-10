import { z } from "zod";
import { transcriptSchema } from "./schemas.js";
import type { KoraTranscript } from "./types.gen.js";

const transcript = z.fromJSONSchema(transcriptSchema);

/** Parses a transcript the server stored after checking it against transcriptSchema with ajv. */
export function parseKoraTranscript(value: unknown): KoraTranscript {
  // fromJSONSchema returns an untyped schema; it is built from the same JSON
  // Schema that types.gen.ts is generated from, so the shapes agree.
  return transcript.parse(value) as KoraTranscript;
}
