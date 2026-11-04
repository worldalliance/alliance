import {
  recognitionCopy,
  RecognitionGroup,
  type GroupResults,
} from "@alliance/common/action-update-copy";
import {
  countRecognitionPreview,
  planRecognition,
  readRecognitionConfig,
  type RecognitionRecipient,
} from "./action-update-recognition";
import { ActionUpdateNotificationMode } from "./entities/action-update.entity";

const split: GroupResults = {
  [RecognitionGroup.Completed]: "a hearing",
  [RecognitionGroup.DidNotComplete]: "a hearing without you",
  [RecognitionGroup.Uninvolved]: "a hearing while you were away",
};

const planned = (
  recipients: Partial<RecognitionRecipient>[],
  results = split,
) =>
  planRecognition({
    results,
    recipients: recipients.map((overrides, index) => ({
      userId: index + 1,
      name: "Avery Example",
      completed: true,
      participant: true,
      ...overrides,
    })),
  }).map((plan) => [plan.userId, plan.allianceResult]);

describe("planRecognition", () => {
  it("gives each group its own result, as written", () => {
    expect(
      planned([
        {},
        { completed: false },
        { completed: false, participant: false },
      ]),
    ).toEqual([
      [1, "a hearing"],
      [2, "a hearing without you"],
      [3, "a hearing while you were away"],
    ]);
  });

  it("puts a completer in the completed group even off the roster", () => {
    expect(planned([{ participant: false }])).toEqual([[1, "a hearing"]]);
  });

  it("leaves out every recipient in a skipped group", () => {
    expect(
      planned([{}, { completed: false }], {
        ...split,
        [RecognitionGroup.Completed]: null,
      }),
    ).toEqual([[2, "a hearing without you"]]);
  });
});

describe("countRecognitionPreview", () => {
  it("counts each group, with completers off the roster as completed", () => {
    expect(
      countRecognitionPreview([
        { completed: true, participant: true },
        { completed: true, participant: false },
        { completed: false, participant: true },
        { completed: false, participant: false },
        { completed: false, participant: false },
      ]),
    ).toEqual({
      [RecognitionGroup.Completed]: 2,
      [RecognitionGroup.DidNotComplete]: 1,
      [RecognitionGroup.Uninvolved]: 2,
    });
  });
});

describe("recognitionCopy", () => {
  const copyOf = (allianceResult: string) =>
    recognitionCopy({
      allianceResult,
      recipientName: "Avery Example",
      link: "https://example.org/a?cid=x",
      projectOrActionName: "Clean Water",
      content: "## What we heard\n\nMost stores said yes.",
    });

  it("leads push and text with Update:, leaving the inbox's own label to say it's an update", () => {
    expect(copyOf("a hearing on the bill")).toEqual({
      inApp: "a hearing on the bill",
      push: "Update: a hearing on the bill",
      sms: "Update: a hearing on the bill https://example.org/a?cid=x",
      emailSubject: "Alliance progress update: Clean Water",
      emailBody: [
        "Hi Avery,",
        'Here\'s an update on a recent Alliance project, "[Clean Water](https://example.org/a?cid=x)."',
        "a hearing on the bill",
        "## What we heard\n\nMost stores said yes.",
        "Best,",
        "The Alliance Team",
      ].join("\n\n"),
    });
  });

  it("keeps the result and name from adding Markdown to the email", () => {
    expect(
      recognitionCopy({
        allianceResult: "# 1. *won*",
        recipientName: "<b>Jo</b>",
        link: "https://example.org/a",
        projectOrActionName: "[x](y)",
        content: "",
      }).emailBody,
    ).toBe(
      [
        "Hi \\<b>Jo\\</b>,",
        'Here\'s an update on a recent Alliance project, "[\\[x\\](y)](https://example.org/a)."',
        "\\# 1. \\*won\\*",
        "Best,",
        "The Alliance Team",
      ].join("\n\n"),
    );
  });
});

describe("readRecognitionConfig", () => {
  const update = {
    notificationMode: ActionUpdateNotificationMode.Normal,
    shortNotifString: "a hearing",
    nonCompleterResult: null as string | null,
  };

  it("gives uninvolved members the didn't-complete text", () => {
    expect(
      readRecognitionConfig({
        ...update,
        nonCompleterResult: "a hearing, which you can still join",
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: "a hearing",
        [RecognitionGroup.DidNotComplete]:
          "a hearing, which you can still join",
        [RecognitionGroup.Uninvolved]: "a hearing, which you can still join",
      },
    });
  });

  it("skips both non-completer groups when that text is empty", () => {
    expect(
      readRecognitionConfig({
        ...update,
        shortNotifString: "",
        nonCompleterResult: "a hearing, which you can still join",
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: null,
        [RecognitionGroup.DidNotComplete]:
          "a hearing, which you can still join",
        [RecognitionGroup.Uninvolved]: "a hearing, which you can still join",
      },
    });
  });

  it("refuses a result with every group empty", () => {
    expect(
      readRecognitionConfig({
        ...update,
        shortNotifString: " ",
      }),
    ).toEqual({ ok: false, error: "Write at least one group's result." });
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
