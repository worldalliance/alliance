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

const { contribution, weeksAgo, name, link } = PREVIEW_PLACEHOLDERS;

describe("previewVariations", () => {
  it("gives personal recognition and everyone else until the result is split", () => {
    const variations = previewVariations({
      mode: "normal",
      texts: texts({ nonCompleterResult: "unused" }),
    });
    expect(variations).toEqual({
      ok: true,
      value: [
        {
          variation: PreviewVariation.CompletedPersonal,
          copy: {
            inApp: `Your ${contribution} led to a hearing.`,
            push: `Your ${contribution} led to a hearing.`,
            sms: `Your ${contribution} led to a hearing. ${link}`,
            emailSubject: `Your ${contribution} led to a hearing.`,
            emailBody: `Hi ${name},\nYour ${contribution} led to a hearing.\n${link}`,
          },
        },
        {
          variation: PreviewVariation.EveryoneElse,
          copy: {
            inApp: "a hearing",
            push: "Update: a hearing",
            sms: `Update: a hearing ${link}`,
            emailSubject: "a hearing",
            emailBody: `Hi ${name},\na hearing\n${link}`,
          },
        },
      ],
    });
  });

  it("leads retrospective recognition with the weeks-ago placeholder", () => {
    const variations = previewVariations({
      mode: "retrospective",
      texts: texts(),
    });
    expect(variations.ok && variations.value[0].copy?.push).toBe(
      `${weeksAgo} you ${contribution}. a hearing.`,
    );
  });

  it("lists each split group, with no copy for one left empty", () => {
    const variations = previewVariations({
      mode: "normal",
      texts: texts({
        splitCollectiveResult: true,
        shortNotifString: "",
        nonCompleterResult: "a hearing without you",
      }),
    });
    expect(
      variations.ok &&
        variations.value.map(({ variation, copy }) => [
          variation,
          copy?.inApp ?? null,
        ]),
    ).toEqual([
      [PreviewVariation.CompletedPersonal, null],
      [PreviewVariation.CompletedCollective, null],
      [PreviewVariation.DidNotComplete, "a hearing without you"],
      [PreviewVariation.Uninvolved, null],
    ]);
  });

  it("says what blocks a send instead of previewing nothing", () => {
    expect(
      previewVariations({
        mode: "normal",
        texts: texts({ shortNotifString: " " }),
      }),
    ).toEqual({ ok: false, error: "Write the collective result." });
    expect(
      previewVariations({
        mode: "normal",
        texts: texts({ splitCollectiveResult: true, shortNotifString: "" }),
      }),
    ).toEqual({ ok: false, error: "Write at least one group's result." });
  });
});
