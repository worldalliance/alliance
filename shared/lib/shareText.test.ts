import type { FormResponseDto } from "../client/types.gen";
import { buildShareText } from "./shareText";

const URL = "https://example.com/actions/1?ref=share-abc";

const makeFormResponse = (
  overrides: Partial<FormResponseDto> = {},
): FormResponseDto =>
  ({
    id: 1,
    formId: 1,
    answers: {},
    visibilityValidatorResults: {},
    publicAnswers: {},
    createdAt: new Date().toISOString(),
    schemaSnapshot: {},
    ...overrides,
  }) as FormResponseDto;

describe("buildShareText name-token interpolation", () => {
  it("replaces #{first-name} with the first whitespace-delimited word", () => {
    const result = buildShareText({
      template: `Hi, I'm #{first-name}!`,
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Hi, I'm Ada!\n\n${URL}`);
  });

  it("replaces #{full-name} with the trimmed full name", () => {
    const result = buildShareText({
      template: `Sincerely, #{full-name}`,
      userName: "  Ada Lovelace  ",
      url: URL,
    });

    expect(result).toBe(`Sincerely, Ada Lovelace\n\n${URL}`);
  });

  it("replaces every occurrence of a token, not just the first", () => {
    const result = buildShareText({
      template: `#{first-name} says hi. #{first-name} invites you.`,
      userName: "Ada",
      url: URL,
    });

    expect(result).toBe(`Ada says hi. Ada invites you.\n\n${URL}`);
  });

  it("handles a single-word name (first === full)", () => {
    const result = buildShareText({
      template: `#{first-name} / #{full-name}`,
      userName: "Ada",
      url: URL,
    });

    expect(result).toBe(`Ada / Ada\n\n${URL}`);
  });

  it("collapses multiple internal whitespace for the first-name split", () => {
    const result = buildShareText({
      template: `#{first-name}!`,
      userName: "Ada   Byron   Lovelace",
      url: URL,
    });

    expect(result).toBe(`Ada!\n\n${URL}`);
  });

  it("leaves tokens untouched when the userName is missing", () => {
    const resultUndefined = buildShareText({
      template: `Hi, #{first-name}`,
      url: URL,
    });
    const resultEmpty = buildShareText({
      template: `Hi, #{first-name}`,
      userName: "",
      url: URL,
    });
    const resultWhitespace = buildShareText({
      template: `Hi, #{first-name}`,
      userName: "   ",
      url: URL,
    });

    expect(resultUndefined).toBe(`Hi, #{first-name}\n\n${URL}`);
    expect(resultEmpty).toBe(`Hi, #{first-name}\n\n${URL}`);
    expect(resultWhitespace).toBe(`Hi, #{first-name}\n\n${URL}`);
  });

  it("returns the url alone when the template is missing or empty after interpolation", () => {
    expect(buildShareText({ template: null, userName: "Ada", url: URL })).toBe(
      URL,
    );
    expect(buildShareText({ template: "   ", userName: "Ada", url: URL })).toBe(
      URL,
    );
  });
});

describe("buildShareText with formResponse", () => {
  it("prefers formResponse.user.name when present", () => {
    const result = buildShareText({
      template: `Hi, #{first-name}!`,
      formResponse: makeFormResponse({
        user: { name: "Ada Lovelace" } as FormResponseDto["user"],
      }),
      userName: "Grace Hopper",
      url: URL,
    });

    expect(result).toBe(`Hi, Ada!\n\n${URL}`);
  });

  it("falls back to supplied userName when formResponse.user is undefined", () => {
    const result = buildShareText({
      template: `Hi, #{first-name}!`,
      formResponse: makeFormResponse(),
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Hi, Ada!\n\n${URL}`);
  });

  it("falls back to supplied userName when formResponse.user.name is missing", () => {
    const result = buildShareText({
      template: `Hi, #{full-name}!`,
      formResponse: makeFormResponse({
        user: {} as FormResponseDto["user"],
      }),
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Hi, Ada Lovelace!\n\n${URL}`);
  });

  it("leaves name tokens untouched when neither formResponse.user nor userName supply a name", () => {
    const result = buildShareText({
      template: `Hi, #{first-name}!`,
      formResponse: makeFormResponse(),
      url: URL,
    });

    expect(result).toBe(`Hi, #{first-name}!\n\n${URL}`);
  });

  it("interpolates form-field tokens alongside name tokens", () => {
    const result = buildShareText({
      template: `#{first-name} wrote: #{note}`,
      formResponse: makeFormResponse({
        answers: { note: "hello world" },
        schemaSnapshot: {
          pages: [
            {
              fields: [{ id: "note", label: "Note", kind: "shortText" }],
            },
          ],
        } as FormResponseDto["schemaSnapshot"],
      }),
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Ada wrote: hello world\n\n${URL}`);
  });

  it("interpolates form-field tokens even when user name is unavailable", () => {
    const result = buildShareText({
      template: `I said: #{note} — #{first-name}`,
      formResponse: makeFormResponse({
        answers: { note: "hi" },
        schemaSnapshot: {
          pages: [
            {
              fields: [{ id: "note", label: "Note", kind: "shortText" }],
            },
          ],
        } as FormResponseDto["schemaSnapshot"],
      }),
      url: URL,
    });

    expect(result).toBe(`I said: hi — #{first-name}\n\n${URL}`);
  });

  it("ignores blank formResponse.user.name and falls back to userName", () => {
    const result = buildShareText({
      template: `Sincerely, #{full-name}`,
      formResponse: makeFormResponse({
        user: { name: "   " } as FormResponseDto["user"],
      }),
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Sincerely, Ada Lovelace\n\n${URL}`);
  });
});
