import { KoraReviewStatus } from "@alliance/common/kora";
import { exportSchema } from "@alliance/kora-review/schemas";
import { koraExport } from "../../test/kora-pairs";
import { checkExport, withoutResultsFor } from "./kora-export-check";
import { koraAjv } from "./kora-upload";

const validate = koraAjv().compile(exportSchema);
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
