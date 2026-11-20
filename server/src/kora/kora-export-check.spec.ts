import { KoraReviewStatus } from "@alliance/common/kora";
import { exportSchema } from "@alliance/kora-review/schemas";
import type { KoraExport } from "@alliance/kora-review/types";
import { KORA_AI_REPLY, koraExport } from "../../test/kora-conversations";
import { checkExport, withoutResultsFor } from "./kora-export-check";
import { koraAjv } from "./kora-upload";

const validate = koraAjv().compile<KoraExport>(exportSchema);
const hash = (n: number) => `sha256:${String(n).repeat(64)}`;
const transcripts = [
  {
    transcript: {
      transcriptId: "T1",
      category: "privacy_and_personal_data_protection",
    },
    contentHash: hash(1),
  },
  {
    transcript: { transcriptId: "T2", category: "fear_trauma_and_distress" },
    contentHash: hash(2),
  },
];
const check = (exported: Record<string, unknown>) =>
  checkExport({
    exported,
    validate,
    reviewerId: "rv1",
    assignmentId: "as1",
    transcripts: transcripts.map((t) => ({
      id: t.transcript.transcriptId,
      contentHash: t.contentHash,
      conversation: [
        { role: "child" as const, text: "Can you write my essay?" },
        { role: "ai" as const, text: KORA_AI_REPLY },
      ],
    })),
  });
const build = (
  options: { done?: string[]; optedOut?: string[]; profile?: boolean } = {},
) =>
  koraExport({
    reviewerId: "rv1",
    assignmentId: "as1",
    transcripts,
    ...options,
  });

describe("checkExport", () => {
  it("reads each transcript's status and whether the profile was answered", () => {
    const result = check(
      build({ done: ["T1"], optedOut: ["T2"], profile: true }),
    );
    if (!result.ok) throw new Error(result.error);
    expect([...result.value.statuses]).toEqual([
      ["T1", KoraReviewStatus.Done],
      ["T2", KoraReviewStatus.OptedOut],
    ]);
    expect(result.value.profileAnswered).toBe(true);
    expect(result.value.optOutCategories).toEqual([]);
  });

  it("reads the categories the reviewer opted out of", () => {
    const result = check({
      ...build({ optedOut: ["T2"] }),
      optOutCategories: ["fear_trauma_and_distress"],
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.optOutCategories).toEqual(["fear_trauma_and_distress"]);
  });

  it("refuses an export for another reviewer or assignment", () => {
    expect(check({ ...build(), reviewer: { id: "rv2" } })).toEqual({
      ok: false,
      error: "names a different reviewer",
    });
    expect(check({ ...build(), batchId: "as2" })).toEqual({
      ok: false,
      error: "names a different assignment",
    });
  });

  it("refuses changed content, an unassigned transcript, or a missing one", () => {
    const changed = build();
    changed.results[0].contentHash = hash(9);
    expect(check(changed)).toEqual({
      ok: false,
      error: "reviewed different content for transcript T1",
    });

    const extra = build();
    extra.results[1].transcriptId = "T9";
    expect(check(extra)).toEqual({
      ok: false,
      error: "has a result for transcript T9, which isn't assigned",
    });

    const missing = build();
    missing.results = missing.results.slice(0, 1);
    expect(check(missing)).toEqual({
      ok: false,
      error: "is missing results for assigned transcripts",
    });
  });

  it("refuses a reaction that isn't on the chatbot's text as the conversation has it", () => {
    const withReaction = (reaction: Record<string, unknown>) => {
      const exported = build();
      exported.results[0]!.reactions = [
        { ...exported.results[0]!.reactions[0]!, ...reaction },
      ];
      return check(exported);
    };
    expect(withReaction({ turnIndex: 0, text: "Can you w" })).toEqual({
      ok: false,
      error: "reacts to turn 0, which isn't the chatbot's in transcript T1",
    });
    expect(withReaction({ turnIndex: 5 })).toEqual({
      ok: false,
      error: "reacts to turn 5, which isn't the chatbot's in transcript T1",
    });
    expect(withReaction({ charEnd: 99 })).toEqual({
      ok: false,
      error: "reacts outside turn 1's text in transcript T1",
    });
    expect(withReaction({ charStart: 4, charEnd: 4 })).toEqual({
      ok: false,
      error: "reacts outside turn 1's text in transcript T1",
    });
    expect(withReaction({ text: "anything else" })).toEqual({
      ok: false,
      error:
        "quotes text turn 1 doesn't have at its reaction's offsets in transcript T1",
    });
    expect(withReaction({ charStart: 2, charEnd: 6, text: "can " }).ok).toBe(
      true,
    );
  });

  it("refuses an export the schema rejects", () => {
    const result = check({ ...build(), unexpected: true });
    expect(result.ok ? "" : result.error).toContain(
      "doesn't match the export schema",
    );
  });
});

describe("withoutResultsFor", () => {
  it("drops the removed pairs' results and stops pointing at a removed pair", () => {
    const exported = { ...build(), currentTranscriptId: "T1" };
    const kept = withoutResultsFor(exported, new Set(["T1"]));
    expect(JSON.stringify(kept)).not.toContain('"T1"');
    expect(kept.currentTranscriptId).toBeNull();
    expect(validate(kept)).toBe(true);
  });

  it("keeps the open pair when it wasn't removed", () => {
    const exported = { ...build(), currentTranscriptId: "T2" };
    expect(
      withoutResultsFor(exported, new Set(["T1"])).currentTranscriptId,
    ).toBe("T2");
  });
});
