import { z } from "zod";
import { exportSchema, SCHEMA_VERSION, transcriptSchema } from "./schemas.js";
import type {
  KoraExitSurvey,
  KoraExport,
  KoraProfile,
  KoraTranscript,
} from "./types.gen.js";

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

const fields = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

function exportDef(name: string): Record<string, unknown> {
  const def = fields(fields(exportSchema.$defs)?.[name]);
  if (!def) throw new Error(`exportSchema has no $defs.${name}.`);
  return def;
}

const profileShape = z.fromJSONSchema(exportDef("profile"));
const profile = z.custom<KoraProfile>(
  (value) => profileShape.safeParse(value).success,
);
const exitSurveyShape = z.fromJSONSchema(exportDef("exitSurvey"));
const exitSurvey = z.custom<KoraExitSurvey>(
  (value) => exitSurveyShape.safeParse(value).success,
);

/** Checks the survey's answers against the export schema before they are stored. */
export const parseKoraProfile = (value: unknown): KoraProfile =>
  profile.parse(value);

export const parseKoraExitSurvey = (value: unknown): KoraExitSurvey =>
  exitSurvey.parse(value);
