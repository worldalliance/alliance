import {
  PREVIEW_PLACEHOLDERS,
  PreviewVariation,
  previewVariations,
  type CollectiveResultTexts,
} from "./updatePreview";

const texts = (
  overrides: Partial<CollectiveResultTexts> = {},
): CollectiveResultTexts => ({
  shortNotifString: "a hearing",
  splitCollectiveResult: false,
  nonCompleterResult: "",
  uninvolvedResult: "",
  ...overrides,
});

const { name, link, project, content } = PREVIEW_PLACEHOLDERS;

describe("previewVariations", () => {
  it("gives everyone the collective result as written until it's split", () => {
    expect(previewVariations(texts({ nonCompleterResult: "unused" }))).toEqual({
      ok: true,
      value: [
        {
          variation: PreviewVariation.Everyone,
          copy: {
            inApp: "a hearing",
            push: "Update: a hearing",
            sms: `Update: a hearing ${link}`,
            emailSubject: `Alliance progress update: ${project}`,
            emailBody: [
              `Hi ${name},`,
              `Here's an update on a recent Alliance project, "[${project}](${link})."`,
              "a hearing",
              content,
              "Best,",
              "The Alliance Team",
            ].join("\n\n"),
          },
        },
      ],
    });
  });

  it("lists each split group, with no copy for one left empty", () => {
    const variations = previewVariations(
      texts({
        splitCollectiveResult: true,
        shortNotifString: "",
        nonCompleterResult: "a hearing without you",
      }),
    );
    expect(
      variations.ok &&
        variations.value.map(({ variation, copy }) => [
          variation,
          copy?.inApp ?? null,
        ]),
    ).toEqual([
      [PreviewVariation.Completed, null],
      [PreviewVariation.DidNotComplete, "a hearing without you"],
      [PreviewVariation.Uninvolved, null],
    ]);
  });

  it("says what blocks a send instead of previewing nothing", () => {
    expect(previewVariations(texts({ shortNotifString: " " }))).toEqual({
      ok: false,
      error: "Write the collective result.",
    });
    expect(
      previewVariations(
        texts({ splitCollectiveResult: true, shortNotifString: "" }),
      ),
    ).toEqual({ ok: false, error: "Write at least one group's result." });
  });
});
