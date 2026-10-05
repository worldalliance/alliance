import { addDays } from "date-fns";
import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";
import {
  evaluateContribution,
  firstSentence,
  planRecognition,
  readRecognitionConfig,
  recognitionCopy,
  type RecognitionConfig,
  type RecognitionRecipient,
} from "./action-update-recognition";
import { RecognitionBranch } from "./entities/action-update-exposure.entity";
import { ActionUpdateNotificationMode } from "./entities/action-update.entity";

const now = new Date("2026-06-15T12:00:00Z");
const schema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "letters", type: "input", kind: "number", label: "N" }],
    },
  ],
};
const lettersFormula = (formula: string) => ({
  inputs: { input1: { kind: "field" as const, fieldId: "letters" } },
  formula,
});
const answered = (letters: number) => ({ answers: { letters }, schema });

const config = (
  mode: RecognitionConfig["mode"],
  formula = '(input1 ?? 0) + " letters"',
): RecognitionConfig => ({
  mode,
  formula: lettersFormula(formula),
  allianceResult: "a hearing on the bill",
});

const recipient = (
  overrides: Partial<RecognitionRecipient> = {},
): RecognitionRecipient => ({
  userId: 1,
  name: "Avery Example",
  arm: ExperimentArm.Variant,
  completion: { completedAt: addDays(now, -3), response: answered(3) },
  ...overrides,
});

const planOne = (
  overrides: Partial<RecognitionRecipient>,
  mode = config(ActionUpdateNotificationMode.Normal),
) => {
  const planned = planRecognition({
    config: mode,
    recipients: [recipient(overrides)],
    now,
  });
  if (!planned.ok) throw new Error(JSON.stringify(planned.error));
  return planned.value[0];
};

const copyOf = (
  overrides: Partial<RecognitionRecipient>,
  mode = config(ActionUpdateNotificationMode.Normal),
) =>
  recognitionCopy({
    message: planOne(overrides, mode).message,
    recipientName: "Avery Example",
    link: "https://example.org/a?cid=x",
  });

describe("planRecognition", () => {
  it("gives completers assigned the variant their contribution", () => {
    const plan = planOne({});
    expect(plan.message.branch).toBe(RecognitionBranch.A);
    expect(plan.contribution).toBe("3 letters");
    expect(plan.completed).toBe(true);
  });

  it("gives control completers and every non-completer the collective result", () => {
    expect(planOne({ arm: ExperimentArm.Control })).toMatchObject({
      completed: true,
      arm: ExperimentArm.Control,
      message: { branch: RecognitionBranch.B },
    });
    expect(planOne({ completion: null })).toMatchObject({
      completed: false,
      arm: ExperimentArm.Variant,
      message: { branch: RecognitionBranch.B },
    });
  });

  it("counts a completion recorded without a response, through the formula's default", () => {
    expect(
      planOne({ completion: { completedAt: now, response: null } })
        .contribution,
    ).toBe("0 letters");
  });

  it("fails with every branch-A member whose contribution doesn't resolve, and only them", () => {
    const planned = planRecognition({
      config: config(
        ActionUpdateNotificationMode.Normal,
        'input1 + " letters"',
      ),
      recipients: [
        recipient({
          userId: 1,
          completion: { completedAt: now, response: null },
        }),
        recipient({ userId: 2 }),
        recipient({
          userId: 3,
          arm: ExperimentArm.Control,
          completion: { completedAt: now, response: null },
        }),
        recipient({ userId: 4, completion: null }),
      ],
      now,
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error.map((issue) => issue.userId)).toEqual([1]);
    expect(planned.error[0].error).toMatch(/empty/);
  });

  it("reports formula errors per member", () => {
    const planned = planRecognition({
      config: config(ActionUpdateNotificationMode.Normal, "foo(1)"),
      recipients: [recipient()],
      now,
    });
    expect(planned.ok).toBe(false);
  });
});

describe("recognitionCopy", () => {
  it("writes normal branch A on every channel", () => {
    expect(copyOf({})).toEqual({
      inApp: "Your 3 letters led to a hearing on the bill.",
      push: "Your 3 letters led to a hearing on the bill.",
      sms: "Your 3 letters led to a hearing on the bill. https://example.org/a?cid=x",
      emailSubject: "Your 3 letters led to a hearing on the bill.",
      emailBody:
        "Hi Avery,\nYour 3 letters led to a hearing on the bill.\nhttps://example.org/a?cid=x",
    });
  });

  it("writes branch B, leaving the inbox's own label to say it's an update", () => {
    expect(copyOf({ completion: null })).toEqual({
      inApp: "a hearing on the bill",
      push: "Update: a hearing on the bill",
      sms: "Update: a hearing on the bill https://example.org/a?cid=x",
      emailSubject: "a hearing on the bill",
      emailBody:
        "Hi Avery,\na hearing on the bill\nhttps://example.org/a?cid=x",
    });
  });

  it.each([
    [6, "Recently you sent 3 letters. A hearing was scheduled."],
    [7, "1 week ago you sent 3 letters. A hearing was scheduled."],
    [14, "2 weeks ago you sent 3 letters. A hearing was scheduled."],
  ])("counts whole weeks %i days after completion", (days, body) => {
    const retrospective: RecognitionConfig = {
      ...config(
        ActionUpdateNotificationMode.Retrospective,
        '"sent " + input1 + " letters"',
      ),
      allianceResult: "A hearing was scheduled",
    };
    const copy = copyOf(
      {
        completion: { completedAt: addDays(now, -days), response: answered(3) },
      },
      retrospective,
    );
    expect(copy.push).toBe(body);
    expect(copy.sms).toBe(`${body} https://example.org/a?cid=x`);
    expect(copy.emailSubject).toBe(body.slice(0, body.indexOf(".") + 1));
    expect(copy.emailBody).toBe(
      `Hi Avery,\n${body}\nhttps://example.org/a?cid=x`,
    );
  });

  it("adds no period after a quote that already ends the sentence", () => {
    const quoted: RecognitionConfig = {
      ...config(ActionUpdateNotificationMode.Normal),
      allianceResult: 'the Senate saying "yes."',
    };
    expect(copyOf({}, quoted).push).toBe(
      'Your 3 letters led to the Senate saying "yes."',
    );
  });

  it("keeps branch B's normal copy in retrospective mode", () => {
    expect(
      copyOf(
        { arm: ExperimentArm.Control },
        config(ActionUpdateNotificationMode.Retrospective),
      ).push,
    ).toBe("Update: a hearing on the bill");
  });
});

describe("email subjects", () => {
  const abbreviated = (mode: RecognitionConfig["mode"], formula: string) =>
    copyOf({}, config(mode, formula)).emailSubject;

  it("never splits a member's contribution", () => {
    expect(
      abbreviated(
        ActionUpdateNotificationMode.Normal,
        '"letters to the U.S. Senate"',
      ),
    ).toBe("Your letters to the U.S. Senate led to a hearing on the bill.");
    expect(
      abbreviated(
        ActionUpdateNotificationMode.Retrospective,
        '"wrote to the U.S. Senate"',
      ),
    ).toBe("Recently you wrote to the U.S. Senate.");
  });

  it("ends at the collective result's first sentence", () => {
    const subjects = (allianceResult: string) =>
      [{}, { arm: ExperimentArm.Control }].map(
        (overrides) =>
          recognitionCopy({
            message: planOne(overrides, {
              ...config(ActionUpdateNotificationMode.Normal),
              allianceResult,
            }).message,
            recipientName: "Avery Example",
            link: "https://example.org",
          }).emailSubject,
      );
    expect(subjects("a hearing. Thank you!")).toEqual([
      "Your 3 letters led to a hearing.",
      "a hearing.",
    ]);
  });
});

describe("firstSentence", () => {
  it("stops at the first sentence end followed by whitespace", () => {
    expect(firstSentence("We won 3.5 seats. Then more!")).toBe(
      "We won 3.5 seats.",
    );
    expect(firstSentence("No ending")).toBe("No ending");
  });

  it("reads past abbreviations", () => {
    expect(
      firstSentence("Your 3 letters led to Dr. Lee's testimony. More soon."),
    ).toBe("Your 3 letters led to Dr. Lee's testimony.");
    expect(firstSentence("Sen. Smith voted yes! Great.")).toBe(
      "Sen. Smith voted yes!",
    );
  });

  it("reads past the abbreviations civic copy names mid-sentence", () => {
    expect(firstSentence("the U.S. Senate passing the bill. More soon.")).toBe(
      "the U.S. Senate passing the bill.",
    );
    expect(firstSentence("Prop. 50 passing. More.")).toBe("Prop. 50 passing.");
    expect(firstSentence("a hearing in the U.K. Parliament. Next.")).toBe(
      "a hearing in the U.K. Parliament.",
    );
  });

  it("reads past bill numbers", () => {
    expect(firstSentence("a vote on H.R. 1")).toBe("a vote on H.R. 1");
    expect(firstSentence("A.B. 5 passing. Thanks!")).toBe("A.B. 5 passing.");
    expect(firstSentence("S.B. 54 passing. Next.")).toBe("S.B. 54 passing.");
  });

  it("ends a sentence at a number", () => {
    expect(firstSentence("a hearing on Oct. 5. More soon.")).toBe(
      "a hearing on Oct. 5.",
    );
    expect(firstSentence("we sent 500. Thanks!")).toBe("we sent 500.");
    expect(firstSentence("A.B. 5. More soon.")).toBe("A.B. 5.");
  });

  it("ends a sentence even when the next one starts lowercase", () => {
    expect(
      firstSentence("2 weeks ago you sent 3 letters. a hearing on the bill."),
    ).toBe("2 weeks ago you sent 3 letters.");
  });
});

describe("evaluateContribution", () => {
  it("reads only the answers it is given", () => {
    expect(
      evaluateContribution(lettersFormula('input1 + " letters"'), answered(9)),
    ).toEqual({ ok: true, value: "9 letters" });
  });

  it("refuses answers or a form version it can't read", () => {
    const formula = lettersFormula('input1 + " letters"');
    expect(
      evaluateContribution(formula, { answers: "garbled", schema }),
    ).toEqual({ ok: false, error: "Their answers can't be read." });
    expect(
      evaluateContribution(formula, {
        answers: { letters: 9 },
        schema: undefined,
      }),
    ).toEqual({
      ok: false,
      error: "The form version they answered can't be read.",
    });
  });
});

describe("readRecognitionConfig", () => {
  const update = {
    notificationMode: ActionUpdateNotificationMode.Normal,
    contributionFormula: lettersFormula("input1"),
    retrospectiveContributionFormula: null,
    shortNotifString: "a hearing",
  };

  it("reads only the selected mode's formula", () => {
    expect(readRecognitionConfig(update).ok).toBe(true);
    expect(
      readRecognitionConfig({
        ...update,
        notificationMode: ActionUpdateNotificationMode.Retrospective,
      }),
    ).toEqual({
      ok: false,
      error: ["Write the retrospective contribution formula."],
    });
  });

  it("reports missing configuration and formulas that don't compile", () => {
    const read = readRecognitionConfig({
      ...update,
      shortNotifString: " ",
      contributionFormula: lettersFormula("(("),
    });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error).toHaveLength(2);
  });

  it("refuses formulas reading other forms", () => {
    const read = readRecognitionConfig({
      ...update,
      contributionFormula: {
        inputs: {
          input1: { kind: "sourceField", sourceFormId: 4, fieldId: "x" },
        },
        formula: "input1",
      },
    });
    expect(read.ok).toBe(false);
  });

  it("refuses legacy updates", () => {
    expect(
      readRecognitionConfig({
        ...update,
        notificationMode: ActionUpdateNotificationMode.Legacy,
      }).ok,
    ).toBe(false);
  });
});
