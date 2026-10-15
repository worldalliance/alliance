import {
  RecognitionBranch,
  recognitionCopy,
  RecognitionGroup,
  type GroupResults,
} from "@alliance/common/action-update-copy";
import { addDays } from "date-fns";
import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";
import {
  countRecognitionPreview,
  evaluateContribution,
  planRecognition,
  readRecognitionConfig,
  type RecognitionConfig,
  type RecognitionRecipient,
} from "./action-update-recognition";
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

const everyGroup = (text: string): GroupResults => ({
  [RecognitionGroup.Completed]: text,
  [RecognitionGroup.DidNotComplete]: text,
  [RecognitionGroup.Uninvolved]: text,
});

const config = (
  mode: RecognitionConfig["mode"],
  formula = '(input1 ?? 0) + " letters"',
): RecognitionConfig => ({
  mode,
  formula: lettersFormula(formula),
  results: everyGroup("a hearing on the bill"),
});

const recipient = (
  overrides: Partial<RecognitionRecipient> = {},
): RecognitionRecipient => ({
  userId: 1,
  name: "Avery Example",
  arm: ExperimentArm.Variant,
  participant: true,
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

describe("split collective result", () => {
  const split: RecognitionConfig = {
    ...config(ActionUpdateNotificationMode.Normal),
    results: {
      [RecognitionGroup.Completed]: "a hearing",
      [RecognitionGroup.DidNotComplete]: "a hearing without you",
      [RecognitionGroup.Uninvolved]: "a hearing while you were away",
    },
  };
  const planned = (recipients: Partial<RecognitionRecipient>[], c = split) => {
    const plans = planRecognition({
      config: c,
      recipients: recipients.map((overrides, index) =>
        recipient({ userId: index + 1, ...overrides }),
      ),
      now,
    });
    if (!plans.ok) throw new Error(JSON.stringify(plans.error));
    return plans.value.map((plan) => [plan.userId, plan.message]);
  };

  it("gives each group its own result", () => {
    expect(
      planned([
        {},
        { arm: ExperimentArm.Control },
        { completion: null },
        { completion: null, participant: false },
      ]),
    ).toEqual([
      [
        1,
        {
          branch: RecognitionBranch.A,
          body: "Your 3 letters led to a hearing.",
          subject: "Your 3 letters led to a hearing.",
        },
      ],
      [2, { branch: RecognitionBranch.B, allianceResult: "a hearing" }],
      [
        3,
        {
          branch: RecognitionBranch.B,
          allianceResult: "a hearing without you",
        },
      ],
      [
        4,
        {
          branch: RecognitionBranch.B,
          allianceResult: "a hearing while you were away",
        },
      ],
    ]);
  });

  it("puts a completer in the completed group even off the roster", () => {
    expect(
      planned([{ arm: ExperimentArm.Control, participant: false }]),
    ).toEqual([
      [1, { branch: RecognitionBranch.B, allianceResult: "a hearing" }],
    ]);
  });

  it("leaves out every recipient in a skipped group, without resolving their contribution", () => {
    expect(
      planned(
        [
          { completion: { completedAt: now, response: null } },
          { arm: ExperimentArm.Control },
          { completion: null },
        ],
        {
          ...config(ActionUpdateNotificationMode.Normal, 'input1 + " letters"'),
          results: { ...split.results, [RecognitionGroup.Completed]: null },
        },
      ),
    ).toEqual([
      [
        3,
        {
          branch: RecognitionBranch.B,
          allianceResult: "a hearing without you",
        },
      ],
    ]);
  });
});

describe("countRecognitionPreview", () => {
  it("counts completers by side, and undrawn ones apart", () => {
    expect(
      countRecognitionPreview([
        { arm: ExperimentArm.Variant, completed: true, participant: true },
        { arm: ExperimentArm.Control, completed: true, participant: false },
        { arm: null, completed: true, participant: true },
        { arm: null, completed: false, participant: true },
        { arm: ExperimentArm.Variant, completed: false, participant: false },
        { arm: null, completed: false, participant: false },
      ]),
    ).toEqual({
      completedPersonal: 1,
      completedCollective: 1,
      completedUndrawn: 1,
      didNotComplete: 1,
      uninvolved: 2,
    });
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
      results: everyGroup("A hearing was scheduled"),
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
      results: everyGroup('the Senate saying "yes."'),
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
              results: everyGroup(allianceResult),
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
    splitCollectiveResult: false,
    nonCompleterResult: null,
    uninvolvedResult: null,
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

  it("reads every group from the collective result until it's split", () => {
    const read = readRecognitionConfig({
      ...update,
      nonCompleterResult: "unused",
    });
    expect(read.ok && read.value.results).toEqual(everyGroup("a hearing"));
  });

  it("skips each split group left empty", () => {
    const read = readRecognitionConfig({
      ...update,
      splitCollectiveResult: true,
      shortNotifString: "",
      nonCompleterResult: "  ",
      uninvolvedResult: "a hearing, which you can still join",
    });
    expect(read.ok && read.value.results).toEqual({
      [RecognitionGroup.Completed]: null,
      [RecognitionGroup.DidNotComplete]: null,
      [RecognitionGroup.Uninvolved]: "a hearing, which you can still join",
    });
  });

  it("refuses a split result with every group empty", () => {
    expect(
      readRecognitionConfig({
        ...update,
        splitCollectiveResult: true,
        shortNotifString: " ",
      }),
    ).toEqual({ ok: false, error: ["Write at least one group's result."] });
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
