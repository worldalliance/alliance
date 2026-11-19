import { z } from "zod";
import {
  exportSchema,
  itemSchema,
  SCHEMA_VERSION,
  transcriptSchema,
} from "./schemas.js";
import type {
  KoraExport,
  KoraFeedback,
  KoraItem,
  KoraTranscript,
} from "./types.gen.js";
import { KoraCategory } from "./types.gen.js";

const custom = <T>(schema: Record<string, unknown>) => {
  const shape = z.fromJSONSchema(schema);
  return z.custom<T>((value) => shape.safeParse(value).success);
};

const fields = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

function exportDef(name: string): Record<string, unknown> {
  const def = fields(fields(exportSchema.$defs)?.[name]);
  if (!def) throw new Error(`exportSchema has no $defs.${name}.`);
  return def;
}

const item = custom<KoraItem>(itemSchema);
// conversationSchema states its item-type rules with if/then/else, which zod can't build, so this
// checks the fields the host reads; the server checked the rest with ajv before storing.
const conversationShape = z.looseObject({
  conversationId: z.string(),
  itemType: z.enum(["scored", "practice", "attention", "test"]),
  riskId: z.enum(KoraCategory),
  scenarioTitle: z.string(),
  childAge: z.number(),
  childBackground: z.string(),
  scenario: z.string(),
  nTurns: z.number(),
  conversation: z.array(
    z.looseObject({ role: z.enum(["child", "ai"]), text: z.string() }),
  ),
});
const conversation = z.custom<KoraStoredConversation>(
  (value) => conversationShape.safeParse(value).success,
);
const transcript = custom<KoraTranscript>(transcriptSchema);
const feedback = custom<KoraFeedback>({
  ...exportDef("feedback"),
  $defs: exportSchema.$defs,
});
const exportShape = z.looseObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  sessionId: z.string(),
  reviewer: z.object({ id: z.string() }),
  ratings: z.array(z.looseObject({ conversationId: z.string() })),
});
// zod can't build the export schema's if/then/else rules, so this checks the
// fields the tool keys on; the server checked the rest with ajv before storing.
const exported = z.custom<KoraExport>(
  (value) => exportShape.safeParse(value).success,
);

/**
 * One conversation as the host stores it, converted from KORA's file. The tool never renders this
 * shape — it carries the answers and the item type the reviewer must not see — so it is typed here
 * for the host rather than generated into the tool's own types.
 */
export type KoraStoredConversation = {
  conversationId: string;
  itemType: "scored" | "practice" | "attention" | "test";
  riskId: KoraCategory;
  scenarioTitle: string;
  ageBand?: string;
  childAge: number;
  childGender?: string | null;
  childBackground: string;
  scenario: string;
  nTurns: number;
  optIn?: boolean;
  conversation: { role: "child" | "ai"; text: string }[];
  comprehensionOptions?: [string, string, string, string];
  comprehensionCorrect?: number;
  referenceVerdict?: "ok" | "not_ok";
  referenceReason?: string;
};

/** Parses a conversation the server stored after checking it against conversationSchema with ajv. */
export const parseKoraConversation = (value: unknown): KoraStoredConversation =>
  conversation.parse(value);

/** Parses one conversation the server serves, after it checked it against itemSchema with ajv. */
export const parseKoraItem = (value: unknown): KoraItem => item.parse(value);

/** Parses a pair the server stored under spec 5.2. Goes with the pair upload. */
export const parseKoraTranscript = (value: unknown): KoraTranscript =>
  transcript.parse(value);

/** Parses the risks a reviewer opted out of, as the server stored them. */
export const parseKoraCategories = (value: unknown): KoraCategory[] =>
  z.array(z.enum(KoraCategory)).parse(value);

/** Parses an export the server stored after checking it against the export schema. */
export const parseKoraExport = (value: unknown): KoraExport =>
  exported.parse(value);

/** Checks the end-of-session answers against the export schema before they are stored. */
export const parseKoraFeedback = (value: unknown): KoraFeedback =>
  feedback.parse(value);
