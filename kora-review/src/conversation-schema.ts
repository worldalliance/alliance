// The v6 import contract: one conversation as the host stores it, converted from KORA's file by
// fromKoraConversation. docs/kora/kora_conversations.schema.yaml types the file itself (Annex B of
// KORA_SPEC 6.0); this types what the conversion produces, and the host validates every stored
// conversation against it. The pair schemas in schemas.ts share the parts declared here.

import { CATEGORY_IDS } from "./risk-ids.js";

const BASE = "https://github.com/worldalliance/korabench-review/schemas";

export const categoryDef = {
  title: "KoraCategory",
  description: "One of KORA's 26 risks.",
  type: "string",
  enum: [...CATEGORY_IDS],
};

export const turnDef = {
  title: "KoraTurn",
  type: "object",
  additionalProperties: false,
  required: ["role", "text"],
  properties: {
    role: { type: "string", enum: ["child", "ai"] },
    text: { type: "string", maxLength: 50000 },
  },
};

export const turnsDef = {
  title: "KoraConversation",
  description:
    "Turns in order, starting on a child turn and alternating. Must contain at least one ai turn; the " +
    "last turn may be either role. AI text may use a small Markdown subset.",
  type: "array",
  minItems: 1,
  items: { $ref: "#/$defs/turn" },
  contains: {
    type: "object",
    required: ["role"],
    properties: { role: { const: "ai" } },
  },
};

const ifItemType = (itemTypes: string[]) => ({
  type: "object",
  required: ["itemType"],
  properties: { itemType: { enum: itemTypes } },
});
/** Every required key is declared here too, which ajv's strictRequired needs. */
export const requires = (keys: string[]) => ({
  type: "object",
  required: keys,
  properties: Object.fromEntries(keys.map((key) => [key, true])),
});
export const forbids = (keys: string[]) => ({
  type: "object",
  properties: Object.fromEntries(keys.map((key) => [key, false])),
});
export const ifConst = (property: string, value: string) => ({
  type: "object",
  required: [property],
  properties: { [property]: { const: value } },
});

/** JSON Schema (draft 2020-12) for one stored conversation: one simulated child, one AI, 2 to 8 AI turns. */
export const conversationSchema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${BASE}/conversation.v1.json`,
  title: "KoraStoredConversation",
  description:
    "One conversation to review: a simulated child and one AI chatbot. conversationId must be unique " +
    "within an upload. Model identity and the judge's grade stay with KORA and are never stored here.",
  type: "object",
  additionalProperties: false,
  required: [
    "conversationId",
    "itemType",
    "riskId",
    "scenarioTitle",
    "childAge",
    "childBackground",
    "scenario",
    "nTurns",
    "conversation",
  ],
  properties: {
    conversationId: { type: "string", minLength: 1, maxLength: 200 },
    itemType: {
      type: "string",
      enum: ["scored", "practice", "attention", "test"],
      description:
        "test conversations are for building and are never exported; practice and attention carry a reference verdict.",
    },
    riskId: { $ref: "#/$defs/category" },
    scenarioTitle: { type: "string", minLength: 1, maxLength: 300 },
    ageBand: { type: "string", maxLength: 50 },
    childAge: { type: "integer", minimum: 0, maximum: 17 },
    childGender: {
      type: ["string", "null"],
      maxLength: 100,
      description: "Free-form, from KORA's own child description.",
    },
    childBackground: { type: "string", minLength: 1, maxLength: 10000 },
    scenario: { type: "string", minLength: 1, maxLength: 20000 },
    nTurns: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      description:
        "AI turns in conversation. Drives the session's load budget and the extended opt-in; checked against the array on import.",
    },
    optIn: {
      type: "boolean",
      description:
        "Sits behind the extended opt-in. Defaults to nTurns > 3 when the import leaves it out.",
    },
    conversation: { $ref: "#/$defs/conversation" },
    comprehensionOptions: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 300 },
      description:
        "Shown in an order the platform shuffles per reviewer; answers record the index here.",
    },
    comprehensionCorrect: { type: "integer", minimum: 0, maximum: 3 },
    referenceVerdict: {
      type: "string",
      enum: ["ok", "not_ok"],
      description:
        "The verdict an attentive reviewer should give. Shown to the reviewer only on practice.",
    },
    referenceReason: {
      type: "string",
      maxLength: 500,
      description:
        "The one line shown with a practice conversation's reference verdict.",
    },
  },
  allOf: [
    {
      if: ifItemType(["practice", "attention"]),
      then: requires(["referenceVerdict"]),
      else: forbids(["referenceVerdict"]),
    },
    {
      if: ifItemType(["practice"]),
      then: requires(["referenceReason"]),
      else: forbids(["referenceReason"]),
    },
    {
      if: ifItemType(["scored", "attention"]),
      then: requires(["comprehensionOptions", "comprehensionCorrect"]),
    },
  ],
  $defs: {
    category: categoryDef,
    conversation: turnsDef,
    turn: turnDef,
  },
};
