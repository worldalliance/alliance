// The contract between this package and its host. The host validates every conversation it stores against
// conversationSchema, every item it serves against itemSchema, and every saved export against exportSchema,
// so all of them use additionalProperties: false throughout. TypeScript types are generated from these
// objects (bun run gen:types → src/types.gen.ts), and a test fails if the generated file is out of date, so
// the two cannot drift.
//
// Bump SCHEMA_VERSION whenever the export changes shape.

import {
  categoryDef,
  forbids,
  ifConst,
  requires,
  turnDef,
  turnsDef,
} from "./conversation-schema.js";

export { conversationSchema } from "./conversation-schema.js";
export { CATEGORY_ENUM_NAMES, CATEGORY_IDS } from "./risk-ids.js";

export const SCHEMA_VERSION = 3 as const;

const BASE = "https://github.com/worldalliance/korabench-review/schemas";

const isoDateTime = { type: "string", format: "date-time" };
const nullableDateTime = { type: ["string", "null"], format: "date-time" };
const contentHash = {
  type: "string",
  pattern: "^sha256:[0-9a-f]{64}$",
  description: "As the host passed it in, unchanged.",
};
const enumOrNull = (values: string[]) => ({
  type: ["string", "null"],
  enum: [...values, null],
});

export const LIKE_REASONS = ["caring", "points_to_an_adult", "other"];
export const DISLIKE_REASONS = [
  "unsafe_advice",
  "not_for_this_age",
  "cold_or_preachy",
  "pretends_to_be_a_friend",
  "other",
];

/**
 * JSON Schema (draft 2020-12) for one line of the pair upload file of spec 5.2: one child, two chatbots.
 * The v6 review has no pairs; this stands until the server's pair upload goes.
 */
export const transcriptSchema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${BASE}/transcript.v2.json`,
  title: "KoraTranscript",
  description:
    "One pair: the same simulated child and opening message, answered by two AI chatbots (conversation A and B). " +
    "transcriptId must be unique within an upload.",
  type: "object",
  additionalProperties: false,
  required: [
    "transcriptId",
    "category",
    "scenarioTitle",
    "childAge",
    "conversationA",
    "conversationB",
  ],
  properties: {
    transcriptId: { type: "string", minLength: 1, maxLength: 200 },
    category: { $ref: "#/$defs/category" },
    pairType: {
      type: "string",
      maxLength: 100,
      description:
        'Free label for the kind of pair, such as "test". Echoed in the export.',
    },
    scenarioTitle: { type: "string", minLength: 1, maxLength: 300 },
    childAge: { type: "integer", minimum: 0, maximum: 17 },
    ageBand: { type: "string", maxLength: 50 },
    childBackground: { type: "string", maxLength: 10000 },
    scenario: { type: "string", maxLength: 20000 },
    conversationA: { $ref: "#/$defs/conversation" },
    conversationB: { $ref: "#/$defs/conversation" },
  },
  $defs: {
    category: categoryDef,
    conversation: turnsDef,
    turn: turnDef,
  },
};

/** JSON Schema (draft 2020-12) for one conversation as the host serves it to a reviewer. */
export const itemSchema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${BASE}/item.v3.json`,
  title: "KoraItem",
  description:
    "One conversation to read and judge, with the risk guide that goes with it. What the host keeps to " +
    "itself: the model, the judge's grade, whether this is the attention conversation, and the correct " +
    "answer to the comprehension question.",
  type: "object",
  additionalProperties: false,
  required: [
    "conversationId",
    "riskId",
    "riskName",
    "guide",
    "hard",
    "firstTimeOnRisk",
    "childAge",
    "childBackground",
    "scenario",
    "scenarioTitle",
    "conversation",
    "comprehension",
    "kind",
    "reference",
    "position",
    "weightUnits",
    "contentHash",
  ],
  properties: {
    conversationId: { type: "string", minLength: 1, maxLength: 200 },
    riskId: { $ref: "#/$defs/category" },
    riskName: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "The risk in one line, as the reviewer sees it.",
    },
    guide: {
      type: "string",
      maxLength: 40000,
      description: "The one-page guide for this risk, Markdown.",
    },
    hard: {
      type: "boolean",
      description:
        "Show the content warning, with its offer to skip, before the conversation.",
    },
    firstTimeOnRisk: {
      type: "boolean",
      description:
        "The reviewer's first conversation on this risk: the guide opens expanded and the soft block applies.",
    },
    childAge: { type: ["integer", "null"], minimum: 0, maximum: 17 },
    childGender: { type: ["string", "null"], maxLength: 100 },
    childBackground: { type: "string", maxLength: 10000 },
    scenario: { type: "string", maxLength: 20000 },
    scenarioTitle: { type: "string", maxLength: 300 },
    conversation: { $ref: "#/$defs/conversation" },
    comprehension: {
      anyOf: [{ $ref: "#/$defs/comprehension" }, { type: "null" }],
      description:
        "Null on a practice conversation, which has no comprehension question.",
    },
    kind: { type: "string", enum: ["practice", "rated"] },
    reference: {
      anyOf: [{ $ref: "#/$defs/reference" }, { type: "null" }],
      description:
        "The answer shown after a practice conversation. Null on a rated one.",
    },
    position: {
      type: ["integer", "null"],
      minimum: 1,
      description:
        "1-based among the rated conversations of this session, from the host. Null on practice.",
    },
    weightUnits: {
      type: "number",
      minimum: 0,
      description:
        "What this conversation costs the session's load budget: 1.0 at three AI turns or fewer, 1.8 above, 0 on practice.",
    },
    contentHash,
  },
  $defs: {
    category: categoryDef,
    conversation: turnsDef,
    turn: turnDef,
    comprehension: {
      title: "KoraComprehension",
      type: "object",
      additionalProperties: false,
      required: ["options"],
      properties: {
        options: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: { type: "string", minLength: 1, maxLength: 300 },
          description:
            "In import order. The tool shuffles them per reviewer and exports the index into this array.",
        },
      },
    },
    reference: {
      title: "KoraReference",
      type: "object",
      additionalProperties: false,
      required: ["verdict", "reason"],
      properties: {
        verdict: { type: "string", enum: ["ok", "not_ok"] },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
};

/** JSON Schema (draft 2020-12) for the export the tool saves: one reviewer's session. */
export const exportSchema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${BASE}/export.v${SCHEMA_VERSION}.json`,
  title: "KoraExport",
  description:
    "Everything one reviewer has done in one session. Contains no name, email or phone number.",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "sessionId",
    "reviewer",
    "exportedAt",
    "place",
    "ratings",
    "skips",
    "feedback",
    "isDone",
  ],
  properties: {
    schemaVersion: { type: "integer", const: SCHEMA_VERSION },
    sessionId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "The session's id, echoed.",
    },
    reviewer: {
      title: "KoraReviewer",
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          description: "The opaque reviewerId the host passed in.",
        },
      },
    },
    exportedAt: isoDateTime,
    place: { $ref: "#/$defs/place" },
    ratings: { type: "array", items: { $ref: "#/$defs/rating" } },
    skips: { type: "array", items: { $ref: "#/$defs/skip" } },
    feedback: { anyOf: [{ $ref: "#/$defs/feedback" }, { type: "null" }] },
    isDone: {
      type: "boolean",
      description:
        "The session is over: its feedback screen was answered or skipped.",
    },
  },
  $defs: {
    category: categoryDef,
    place: {
      title: "KoraPlace",
      description:
        "Where the reviewer was when the export was made, so the tool reopens there.",
      type: "object",
      additionalProperties: false,
      required: ["conversationId", "screen"],
      properties: {
        conversationId: { type: ["string", "null"], maxLength: 200 },
        screen: { type: ["string", "null"], enum: ["read", "judge", null] },
      },
    },
    rating: {
      title: "KoraRating",
      description:
        "One conversation the reviewer was given, in the order served. A rating counts only when its status is done.",
      type: "object",
      additionalProperties: false,
      required: [
        "conversationId",
        "riskId",
        "contentHash",
        "kind",
        "status",
        "firstTimeOnRisk",
        "highlights",
        "startedAt",
        "readSubmittedAt",
        "completedAt",
        "timeMsRead",
        "timeMsJudge",
      ],
      properties: {
        conversationId: { type: "string", minLength: 1, maxLength: 200 },
        riskId: { $ref: "#/$defs/category" },
        contentHash,
        kind: { type: "string", enum: ["practice", "rated"] },
        status: { type: "string", enum: ["reading", "judging", "done"] },
        position: {
          type: "integer",
          minimum: 1,
          description: "1-based among the rated conversations of this session.",
        },
        firstTimeOnRisk: { type: "boolean" },
        comprehensionAnswer: {
          type: "integer",
          minimum: 0,
          maximum: 3,
          description:
            "The index into the import's options, not the position it was shown in.",
        },
        q1: { type: "string", enum: ["ok", "not_ok"] },
        q2Confidence: { type: "integer", minimum: 1, maximum: 4 },
        q3Severity: { type: "integer", minimum: 1, maximum: 4 },
        q4Text: { type: "string", maxLength: 280 },
        highlights: { type: "array", items: { $ref: "#/$defs/highlight" } },
        startedAt: isoDateTime,
        readSubmittedAt: nullableDateTime,
        completedAt: nullableDateTime,
        timeMsRead: {
          type: "integer",
          minimum: 0,
          description: "Time on the Read screen while the page was visible.",
        },
        timeMsJudge: { type: "integer", minimum: 0 },
        stale: {
          type: "object",
          additionalProperties: false,
          required: ["moved", "lost"],
          description:
            "Present when the conversation's contentHash changed after it was highlighted.",
          properties: {
            moved: { type: "integer", minimum: 0 },
            lost: { type: "integer", minimum: 0 },
          },
        },
      },
      allOf: [
        {
          if: ifConst("status", "done"),
          then: requires([
            "q1",
            "q2Confidence",
            "readSubmittedAt",
            "completedAt",
          ]),
        },
        {
          if: {
            type: "object",
            required: ["status", "kind"],
            properties: { status: { const: "done" }, kind: { const: "rated" } },
          },
          then: requires(["comprehensionAnswer", "position"]),
        },
        {
          if: ifConst("q1", "not_ok"),
          then: requires(["q3Severity"]),
          else: forbids(["q3Severity", "q4Text"]),
        },
      ],
    },
    highlight: {
      title: "KoraHighlight",
      description: "A span of one AI turn, marked while reading.",
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "turnIndex",
        "charStart",
        "charEnd",
        "text",
        "valence",
        "createdAt",
      ],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 64 },
        turnIndex: {
          type: "integer",
          minimum: 0,
          description:
            "Index into the conversation as the host served it. Always an ai turn.",
        },
        charStart: {
          type: "integer",
          minimum: 0,
          description:
            "Offset into that turn's text, counted in Unicode code points.",
        },
        charEnd: {
          type: "integer",
          minimum: 1,
          description: "Half-open, so the span is [charStart, charEnd).",
        },
        text: {
          type: "string",
          maxLength: 50000,
          description:
            "That turn's text sliced by the offsets, verbatim, Markdown markers and all.",
        },
        valence: { type: "string", enum: ["like", "dislike"] },
        reason: {
          type: "string",
          enum: [...new Set([...LIKE_REASONS, ...DISLIKE_REASONS])],
        },
        createdAt: isoDateTime,
        orphaned: {
          type: "boolean",
          description:
            "Couldn't be re-anchored after the conversation's text changed.",
        },
      },
      allOf: [
        {
          if: ifConst("valence", "like"),
          then: {
            type: "object",
            properties: { reason: { enum: LIKE_REASONS } },
          },
          else: {
            type: "object",
            properties: { reason: { enum: DISLIKE_REASONS } },
          },
        },
      ],
    },
    skip: {
      title: "KoraSkip",
      description:
        "A conversation skipped from its content warning, before it was read.",
      type: "object",
      additionalProperties: false,
      required: ["conversationId", "riskId", "at"],
      properties: {
        conversationId: { type: "string", minLength: 1, maxLength: 200 },
        riskId: { $ref: "#/$defs/category" },
        at: isoDateTime,
      },
    },
    feedback: {
      title: "KoraFeedback",
      description:
        "The end-of-session feedback. Every question is optional; null means skipped.",
      type: "object",
      additionalProperties: false,
      required: [
        "answeredAt",
        "f1",
        "f2",
        "f3",
        "f3Text",
        "f4",
        "f5",
        "f5Text",
        "f6",
        "f7",
      ],
      properties: {
        answeredAt: isoDateTime,
        f1: enumOrNull(["not_at_all", "not_really", "mostly", "fully"]),
        f2: enumOrNull(["very_easy", "easy", "hard", "very_hard"]),
        f3: enumOrNull(["yes", "no"]),
        f3Text: { type: ["string", "null"], maxLength: 2000 },
        f4: enumOrNull(["not_at_all", "not_really", "mostly", "fully"]),
        f5: enumOrNull(["yes", "no"]),
        f5Text: { type: ["string", "null"], maxLength: 2000 },
        f6: enumOrNull(["shorter", "about_right", "longer"]),
        f7: { type: ["string", "null"], maxLength: 2000 },
      },
    },
  },
};
