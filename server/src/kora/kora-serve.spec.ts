import { KoraItemType } from "@alliance/common/kora";
import { pickNext } from "./kora-queue";
import {
  attentionDue,
  attentionPosition,
  fits,
  practiceDue,
  ratedCount,
  spentUnits,
} from "./kora-serve";

const short = (n: number) =>
  Array.from({ length: n }, () => ({
    itemType: KoraItemType.Scored,
    nTurns: 3,
  }));
const extended = (n: number) =>
  Array.from({ length: n }, () => ({
    itemType: KoraItemType.Scored,
    nTurns: 8,
  }));
const practice = (n: number) =>
  Array.from({ length: n }, () => ({
    itemType: KoraItemType.Practice,
    nTurns: 3,
  }));

describe("the session's load budget", () => {
  it("counts a long conversation for more, and practice for nothing", () => {
    expect(spentUnits(short(3))).toBe(3);
    expect(spentUnits(extended(2))).toBeCloseTo(3.6);
    expect(spentUnits(practice(2))).toBe(0);
    expect(ratedCount([...practice(2), ...short(1)])).toBe(1);
  });

  it("stops serving when the next conversation would pass the budget", () => {
    expect(fits({ held: short(4), nTurns: 3, budgetUnits: 5 })).toBe(true);
    expect(fits({ held: short(5), nTurns: 3, budgetUnits: 5 })).toBe(false);
    expect(fits({ held: extended(3), nTurns: 8, budgetUnits: 5 })).toBe(false);
  });

  it("serves three conversations however long they are", () => {
    expect(fits({ held: extended(1), nTurns: 8, budgetUnits: 5 })).toBe(true);
    expect(fits({ held: extended(2), nTurns: 3, budgetUnits: 5 })).toBe(true);
    expect(spentUnits(extended(3))).toBeCloseTo(5.4);
  });

  it("counts the attention conversation like any other", () => {
    const held = [{ itemType: KoraItemType.Attention, nTurns: 3 }, ...short(4)];
    expect(spentUnits(held)).toBe(5);
    expect(fits({ held, nTurns: 3, budgetUnits: 5 })).toBe(false);
  });
});

describe("practice and attention", () => {
  it("gives both practice conversations, in the first session only", () => {
    expect(practiceDue({ sessionNumber: 1, practiceServed: 0 })).toBe(0);
    expect(practiceDue({ sessionNumber: 1, practiceServed: 1 })).toBe(1);
    expect(practiceDue({ sessionNumber: 1, practiceServed: 2 })).toBe(null);
    expect(practiceDue({ sessionNumber: 2, practiceServed: 0 })).toBe(null);
  });

  it("puts the attention conversation at the same position every time it is asked", () => {
    const reviewerId = "rv_8f3a2c71";
    const at = attentionPosition(reviewerId);
    expect([2, 3]).toContain(at);
    expect(attentionPosition(reviewerId)).toBe(at);

    const due = (ratedSoFar: number) =>
      attentionDue({
        sessionNumber: 1,
        held: [...practice(2), ...short(ratedSoFar)],
        attentionServedBefore: false,
        reviewerId,
      });
    expect(due(at - 1)).toBe(true);
    expect(due(at)).toBe(false);
  });

  it("gives a reviewer one attention conversation, in their first session", () => {
    const reviewerId = "rv_other";
    const held = short(attentionPosition(reviewerId) - 1);
    expect(
      attentionDue({
        sessionNumber: 1,
        held,
        attentionServedBefore: true,
        reviewerId,
      }),
    ).toBe(false);
    expect(
      attentionDue({
        sessionNumber: 2,
        held,
        attentionServedBefore: false,
        reviewerId,
      }),
    ).toBe(false);
    expect(
      attentionDue({
        sessionNumber: 1,
        held: [
          ...held.slice(1),
          { itemType: KoraItemType.Attention, nTurns: 3 },
        ],
        attentionServedBefore: false,
        reviewerId,
      }),
    ).toBe(false);
  });
});

describe("pickNext", () => {
  const candidate = (
    id: string,
    riskId: string,
    coverage: number,
    options: { completed?: number; target?: number } = {},
  ) => ({
    id,
    riskId,
    nTurns: 3,
    coverage,
    completed: options.completed ?? coverage,
    target: options.target ?? 3,
    closesAt: null,
  });

  it("takes the least covered conversation", () => {
    const picked = pickNext({
      candidates: [
        candidate("a", "cybersecurity", 2),
        candidate("b", "cybersecurity", 0),
        candidate("c", "cybersecurity", 1),
      ],
      seenRisks: new Set(),
      random: () => 0,
    });
    expect(picked?.id).toBe("b");
  });

  it("prefers a risk the reviewer hasn't met, among the least covered", () => {
    const picked = pickNext({
      candidates: [
        candidate("seen", "cybersecurity", 0),
        candidate("fresh", "bias_and_stereotyping", 0),
        candidate("covered", "cognitive_mismatch", 3),
      ],
      seenRisks: new Set(["cybersecurity"]),
      random: () => 0,
    });
    expect(picked?.id).toBe("fresh");
  });

  it("falls back to a risk they have met when that is all there is", () => {
    const picked = pickNext({
      candidates: [candidate("only", "cybersecurity", 1)],
      seenRisks: new Set(["cybersecurity"]),
      random: () => 0.99,
    });
    expect(picked?.id).toBe("only");
    expect(
      pickNext({ candidates: [], seenRisks: new Set(), random: () => 0 }),
    ).toBe(null);
  });

  it("breaks a tie at random, so two reviewers don't queue behind one conversation", () => {
    const candidates = [
      candidate("a", "cybersecurity", 0),
      candidate("b", "cybersecurity", 0),
    ];
    const seenRisks = new Set(["cybersecurity"]);
    expect(pickNext({ candidates, seenRisks, random: () => 0 })?.id).toBe("a");
    expect(pickNext({ candidates, seenRisks, random: () => 0.6 })?.id).toBe(
      "b",
    );
  });
});
