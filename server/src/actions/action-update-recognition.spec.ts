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

const everyGroup = (text: string): GroupResults => ({
  [RecognitionGroup.Completed]: text,
  [RecognitionGroup.DidNotComplete]: text,
  [RecognitionGroup.Uninvolved]: text,
});

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
    splitCollectiveResult: false,
    nonCompleterResult: null,
    uninvolvedResult: null,
  };

  it("reads every group from the collective result until it's split", () => {
    expect(
      readRecognitionConfig({ ...update, nonCompleterResult: "unused" }),
    ).toEqual({ ok: true, value: everyGroup("a hearing") });
  });

  it("requires the collective result until it's split", () => {
    expect(readRecognitionConfig({ ...update, shortNotifString: " " })).toEqual(
      { ok: false, error: "Write the collective result." },
    );
  });

  it("skips each split group left empty", () => {
    expect(
      readRecognitionConfig({
        ...update,
        splitCollectiveResult: true,
        shortNotifString: "",
        nonCompleterResult: "  ",
        uninvolvedResult: "a hearing, which you can still join",
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: null,
        [RecognitionGroup.DidNotComplete]: null,
        [RecognitionGroup.Uninvolved]: "a hearing, which you can still join",
      },
    });
  });

  it("refuses a split result with every group empty", () => {
    expect(
      readRecognitionConfig({
        ...update,
        splitCollectiveResult: true,
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
