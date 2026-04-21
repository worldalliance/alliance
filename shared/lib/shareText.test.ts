import { buildShareText } from "./shareText";

const URL = "https://example.com/actions/1?ref=share-abc";

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
