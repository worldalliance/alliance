import { KoraReviewStatus } from "@alliance/common/kora";
import { exportSchema } from "@alliance/kora-review/schemas";
import { koraSessionExport } from "../../test/kora-conversations";
import {
  changedRatings,
  checkExport,
  withoutRatingsFor,
} from "./kora-export-check";
import { koraAjv } from "./kora-upload";

const validate = koraAjv().compile(exportSchema);
const hash = (n: number) => `sha256:${String(n).repeat(64)}`;
const conversations = [
  {
    id: "C1",
    riskId: "privacy_and_personal_data_protection",
    contentHash: hash(1),
  },
  { id: "C2", riskId: "fear_trauma_and_distress", contentHash: hash(2) },
];
const check = (exported: Record<string, unknown>) =>
  checkExport({
    exported,
    validate,
    reviewerId: "rv1",
    sessionId: "ses1",
    conversations: conversations.map((c) => ({
      id: c.id,
      contentHash: c.contentHash,
    })),
  });
const build = (options: { done?: string[]; skipped?: string[] } = {}) =>
  koraSessionExport({
    reviewerId: "rv1",
    sessionId: "ses1",
    conversations,
    ...options,
  });

describe("checkExport", () => {
  it("reads each conversation's status, including the skipped ones", () => {
    const result = check(build({ done: ["C1"], skipped: ["C2"] }));
    if (!result.ok) throw new Error(result.error);
    expect([...result.value.statuses]).toEqual([
      ["C1", KoraReviewStatus.Done],
      ["C2", KoraReviewStatus.OptedOut],
    ]);
  });

  it("counts a conversation still being read as pending", () => {
    const result = check(build());
    if (!result.ok) throw new Error(result.error);
    expect(result.value.statuses.get("C1")).toBe(KoraReviewStatus.Pending);
  });

  it("refuses an export for another reviewer or session", () => {
    const other = { ...build(), reviewer: { id: "rv2" } };
    expect(check(other)).toEqual({
      ok: false,
      error: "names a different reviewer",
    });
    expect(check({ ...build(), sessionId: "ses2" })).toEqual({
      ok: false,
      error: "names a different session",
    });
  });

  it("refuses changed content and a conversation it was never given", () => {
    const changed = build();
    changed.ratings[0].contentHash = hash(9);
    expect(check(changed)).toEqual({
      ok: false,
      error: "rated different content for conversation C1",
    });

    const unknown = build();
    unknown.ratings[0].conversationId = "C9";
    expect(check(unknown)).toEqual({
      ok: false,
      error: "has a rating for conversation C9, which isn't in this session",
    });

    const skipped = build({ skipped: ["C2"] });
    skipped.skips[0].conversationId = "C9";
    expect(check(skipped)).toEqual({
      ok: false,
      error: "skipped conversation C9, which isn't in this session",
    });
  });

  it("refuses an export that doesn't match the schema", () => {
    const result = check({ ...build(), ratings: [{ conversationId: "C1" }] });
    expect(result.ok).toBe(false);
  });
});

describe("withoutRatingsFor", () => {
  it("drops a conversation's rating and skip, and the place that pointed at it", () => {
    const exported = build({ skipped: ["C2"] });
    const kept = withoutRatingsFor(exported, new Set(["C1", "C2"]));
    expect(kept.ratings).toEqual([]);
    expect(kept.skips).toEqual([]);
    expect(kept.place).toEqual({ conversationId: null, screen: null });
  });

  it("leaves the export alone when nothing was dropped", () => {
    const exported = build();
    expect(withoutRatingsFor(exported, new Set())).toBe(exported);
  });
});

describe("changedRatings", () => {
  it("names the conversations whose rating differs from the stored one", () => {
    const before = build();
    const after = build({ done: ["C1"] });
    expect([...changedRatings(before, after)]).toEqual(["C1"]);
    expect([...changedRatings(before, before)]).toEqual([]);
  });
});
