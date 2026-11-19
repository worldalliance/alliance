import {
  koraAttention,
  koraConversation,
  koraJsonlFile,
  koraPractice,
} from "../../test/kora-conversations";
import { checkConversations, contentHash } from "./kora-upload";

const checkFile = (
  text: string,
  existing: string[] = [],
  retired: string[] = [],
  existingPractice = 0,
) =>
  checkConversations({
    text,
    existingIds: new Set([...existing, ...retired]),
    retiredIds: new Set(retired),
    existingPractice,
  });

/** A production-shaped file: the review's two practice conversations, then what is being tested. */
const review = (...conversations: object[]) =>
  koraJsonlFile(koraPractice("PR-1"), koraPractice("PR-2"), ...conversations);

describe("checkConversations", () => {
  it("converts every conversation, keeping only the schema's fields, with a hash of what is stored", () => {
    const result = checkFile(review(koraConversation("C1")));
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.map((c) => c.id)).toEqual(["PR-1", "PR-2", "C1"]);
    const scored = result.value[2];
    expect(scored.riskId).toBe("academic_dishonesty_and_misuse");
    expect(scored.itemType).toBe("scored");
    expect(scored.nTurns).toBe(1);
    expect(scored.content).not.toHaveProperty("risk_category_id");
    expect(scored.contentHash).toBe(contentHash(scored.content));
  });

  it("reads the same conversations from a YAML list", () => {
    const yaml = [koraPractice("PR-1"), koraPractice("PR-2")]
      .map((c) => `- ${JSON.stringify(c)}`)
      .join("\n");
    const result = checkFile(yaml);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.map((c) => c.id)).toEqual(["PR-1", "PR-2"]);
  });

  it("rejects a conversation whose nTurns doesn't match its AI turns", () => {
    const result = checkFile(review(koraConversation("C1", { n_turns: 3 })));
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toEqual([
      { line: 3, problems: ["says nTurns 3 but has 1 AI turns"] },
    ]);
  });

  it("rejects a conversation that doesn't start on a child turn or alternates wrongly", () => {
    const reversed = koraConversation("C1", {
      conversation: [
        { role: "ai", text: "Hello." },
        { role: "ai", text: "Still me." },
        { role: "child", text: "Hi." },
      ],
      n_turns: 2,
    });
    const result = checkFile(review(reversed));
    if (result.ok) throw new Error("expected rejection");
    expect(result.error[0].problems).toEqual([
      "doesn't start on a child turn",
      "has two turns in a row from the same speaker",
    ]);
  });

  it("rejects a scored conversation with no comprehension question", () => {
    const result = checkFile(
      review(koraConversation("C1", { comprehension_options: undefined })),
    );
    if (result.ok) throw new Error("expected rejection");
    expect(result.error[0].problems.join()).toContain("comprehensionOptions");
  });

  it("counts the review's two practice conversations across every upload", () => {
    const staged = checkFile(koraJsonlFile(koraConversation("C1")), [], [], 2);
    expect(staged.ok).toBe(true);

    const third = checkFile(koraJsonlFile(koraPractice("PR-3")), [], [], 2);
    if (third.ok) throw new Error("expected rejection");
    expect(third.error).toEqual([
      {
        line: 1,
        problems: ["this would leave 3 practice conversations; a review has 2"],
      },
    ]);
  });

  it("takes a file of test material, which carries no practice conversations", () => {
    const result = checkFile(
      koraJsonlFile(
        koraConversation("T1", {
          item_type: "test",
          comprehension_options: undefined,
          comprehension_correct: undefined,
        }),
      ),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.map((c) => c.itemType)).toEqual(["test"]);
  });

  it("allows one attention conversation per risk and reports a second", () => {
    const ok = checkFile(
      review(
        koraAttention("AT-1"),
        koraAttention("AT-2", {
          risk_id: "cybersecurity",
          risk_category_id: "online_safety",
        }),
      ),
    );
    expect(ok.ok).toBe(true);

    const twice = checkFile(
      review(koraAttention("AT-1"), koraAttention("AT-2")),
    );
    if (twice.ok) throw new Error("expected rejection");
    expect(twice.error).toEqual([
      {
        line: 4,
        problems: [
          "academic_dishonesty_and_misuse already has an attention conversation, on line 3",
        ],
      },
    ]);
  });

  it("reports repeats and ids from earlier batches, by line", () => {
    const repeated = checkFile(
      review(koraConversation("C1"), koraConversation("C1")),
    );
    if (repeated.ok) throw new Error("expected rejection");
    expect(repeated.error).toEqual([
      { line: 4, problems: ["repeats conversation C1 from line 3"] },
    ]);

    const old = checkFile(review(koraConversation("OLD")), ["OLD"]);
    if (old.ok) throw new Error("expected rejection");
    expect(old.error[0].problems).toEqual([
      "conversation OLD was already uploaded in an earlier batch",
    ]);

    const retired = checkFile(review(koraConversation("OLD")), [], ["OLD"]);
    if (retired.ok) throw new Error("expected rejection");
    expect(retired.error[0].problems).toEqual([
      "conversation OLD belongs to a retired batch, so reactivate that batch instead",
    ]);
  });

  it("rejects an empty file", () => {
    expect(checkFile("\n\n").ok).toBe(false);
  });
});
