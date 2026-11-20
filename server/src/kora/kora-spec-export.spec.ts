import { SAMPLE_EXPORT } from "@alliance/kora-review/sample-export";
import {
  KoraCategory,
  type KoraExport,
  type KoraTranscript,
} from "@alliance/kora-review/types";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { buildKoraSpecExport } from "./kora-spec-export";

// KORA's schema uses a propertyOrder keyword and untyped conditionals that ajv's strict mode rejects.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validKoraExport = ajv.compile(
  parse(
    readFileSync(
      join(__dirname, "../../../docs/kora/kora_export.schema.yaml"),
      "utf8",
    ),
  ),
);

const AI = "Sure! Here's an essay.\nCopy it in.\nYou're done!";
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function exported(): KoraExport {
  const e = clone(SAMPLE_EXPORT) as KoraExport;
  const [pending, done, untouched] = e.results;
  e.results = [
    {
      ...done!,
      transcriptId: "C1",
      q1: "not_ok",
      q2_confidence: 3,
      q3_severity: 4,
      q4_text: "It hands over the essay",
      reactions: [
        {
          turnIndex: 1,
          charStart: 0,
          charEnd: 22,
          text: "Sure! Here's an essay.",
          kind: "down",
        },
        {
          turnIndex: 1,
          charStart: 35,
          charEnd: 47,
          text: "You're done!",
          kind: "down",
        },
        {
          turnIndex: 1,
          charStart: 23,
          charEnd: 34,
          text: "Copy it in.",
          kind: "notable",
        },
      ],
    },
    { ...done!, transcriptId: "C2", pairPosition: 2, reactions: [] },
    {
      ...untouched!,
      transcriptId: "C3",
      category: KoraCategory.Violence,
      optedOut: true,
      optedOutAt: "2026-11-10T18:06:00.000Z",
    },
    {
      ...pending!,
      transcriptId: "T1",
      status: "done",
      q1: "ok",
      q2_confidence: 4,
      pairPosition: 3,
      completedAt: "2026-11-10T18:09:00.000Z",
    },
  ];
  e.optOutCategories = [KoraCategory.Violence];
  return e;
}

const conversation = (itemType: KoraTranscript["itemType"]) => ({
  itemType,
  conversation: [
    { role: "child" as const, text: "write my essay" },
    { role: "ai" as const, text: AI },
  ],
});

function buildInput(): Parameters<typeof buildKoraSpecExport>[0] {
  return {
    generatedAt: new Date("2026-12-08T09:00:00Z"),
    kind: "rolling",
    reviewers: [
      { id: "rv-1", createdAt: new Date("2026-11-01T10:00:00Z") },
      { id: "rv-2", createdAt: new Date("2026-11-02T10:00:00Z") },
    ],
    assignments: [
      {
        id: "a1",
        reviewerId: "rv-1",
        createdAt: new Date("2026-11-10T17:59:00Z"),
        completedAt: new Date("2026-11-10T18:10:00Z"),
        exported: exported(),
      },
    ],
    conversations: new Map([
      ["C1", conversation("scored")],
      ["C2", conversation("practice")],
      ["C3", conversation("scored")],
      ["T1", conversation("test")],
    ]),
  };
}

const build = () => buildKoraSpecExport(buildInput());

describe("buildKoraSpecExport", () => {
  it("produces a file that matches KORA's export schema", () => {
    const out = build();
    expect(validKoraExport(out) ? null : validKoraExport.errors).toBeNull();
    expect(out.export.counts).toEqual({
      ratings: 2,
      highlights: 2,
      sessions: 1,
      skips: 1,
      reviewers: 2,
    });
  });

  it("rates finished conversations only, leaves out test ones, and nulls Q3 and Q4 on ok", () => {
    const { ratings } = build();
    expect(
      ratings.map((r) => [
        r.conversation_id,
        r.item_type,
        r.q1,
        r.q3_severity,
        r.q4_text,
      ]),
    ).toEqual([
      ["C1", "scored", "not_ok", 4, "It hands over the essay"],
      ["C2", "practice", "ok", null, null],
    ]);
  });

  it("turns a run of thumbs down into one dislike and leaves out notable lines", () => {
    const { highlights, ratings } = build();
    expect(highlights.map((h) => [h.rating_id, h.text, h.valence])).toEqual([
      ["a1.C1", "Sure! Here's an essay.", "dislike"],
      ["a1.C1", "You're done!", "dislike"],
    ]);
    expect(ratings[0]!.n_highlights).toBe(2);
  });

  it("quotes highlights from the conversation, and fails on a reaction to a turn it doesn't have", () => {
    const input = (
      reaction: KoraExport["results"][number]["reactions"][number],
    ) => {
      const e = exported();
      e.results[1]!.reactions = [reaction];
      return {
        ...buildInput(),
        assignments: [{ ...buildInput().assignments[0]!, exported: e }],
      };
    };
    const like = {
      turnIndex: 1,
      charStart: 23,
      charEnd: 34,
      text: "not what the conversation has",
      kind: "up" as const,
    };
    expect(
      buildKoraSpecExport(input(like)).highlights.map((h) => [
        h.text,
        h.valence,
      ]),
    ).toContainEqual(["Copy it in.", "like"]);
    expect(() => buildKoraSpecExport(input({ ...like, turnIndex: 7 }))).toThrow(
      "Assignment a1 reacts to turn 7 of C2, which it doesn't have",
    );
  });

  it("records a topic skip, and the reviewer's opt-outs and totals", () => {
    const { skips, reviewers, sessions } = build();
    expect(skips).toEqual([
      {
        conversation_id: "C3",
        risk_id: "violence_and_physical_harm",
        reviewer_id: "rv-1",
        scope: "risk",
        timestamp: "2026-11-10T18:06:00.000Z",
      },
    ]);
    expect(
      reviewers.map((r) => [
        r.reviewer_id,
        r.opt_out_risks,
        r.ratings_completed,
        r.sessions_completed,
      ]),
    ).toEqual([
      ["rv-1", ["violence_and_physical_harm"], 2, 1],
      ["rv-2", [], 0, 0],
    ]);
    expect(sessions[0]).toMatchObject({
      session_id: "a1",
      session_number: 1,
      ratings_completed: 2,
    });
  });
});
