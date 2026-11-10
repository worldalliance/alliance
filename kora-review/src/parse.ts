import { z } from "zod";
import { SCHEMA_VERSION, transcriptSchema } from "./schemas.js";
import type { KoraExport, KoraTranscript } from "./types.gen.js";

const transcriptShape = z.fromJSONSchema(transcriptSchema);
const transcript = z.custom<KoraTranscript>(
  (value) => transcriptShape.safeParse(value).success,
);
const exportShape = z.looseObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  batchId: z.string(),
  reviewer: z.object({ id: z.string() }),
  results: z.array(z.looseObject({ transcriptId: z.string() })),
});
// zod can't build the export schema's if/then/else rules, so this checks the
// fields the tool keys on; the server checked the rest with ajv before storing.
const exported = z.custom<KoraExport>(
  (value) => exportShape.safeParse(value).success,
);

/** Parses a transcript the server stored after checking it against transcriptSchema with ajv. */
export function parseKoraTranscript(value: unknown): KoraTranscript {
  return transcript.parse(value);
}

/** Parses an export the server stored after checking it against the batch's export schema. */
export function parseKoraExport(value: unknown): KoraExport {
  return exported.parse(value);
}
