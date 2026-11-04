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
  nonCompleterResult: "",
  ...overrides,
});

const { name, link, project, content } = PREVIEW_PLACEHOLDERS;

describe("previewVariations", () => {
  it("lists each group, with no copy for one left empty", () => {
    const variations = previewVariations(
      texts({
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
    ]);
  });

  it("previews the completed text as written", () => {
    expect(previewVariations(texts())).toEqual({
      ok: true,
      value: [
        {
          variation: PreviewVariation.Completed,
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
        {
          variation: PreviewVariation.DidNotComplete,
          copy: null,
        },
      ],
    });
  });

  it("says what blocks a send instead of previewing nothing", () => {
    expect(previewVariations(texts({ shortNotifString: " " }))).toEqual({
      ok: false,
      error: "Write at least one group's result.",
    });
  });
});
