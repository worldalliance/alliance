import { buildShareText } from "./shareText";

const URL = "https://example.com/actions/1?ref=share-abc";

describe("buildShareText name-token interpolation", () => {
  it("replaces [First Name] with the first whitespace-delimited word", () => {
    const result = buildShareText({
      template: "Hi, I'm [First Name]!",
      userName: "Ada Lovelace",
      url: URL,
    });

    expect(result).toBe(`Hi, I'm Ada!\n\n${URL}`);
  });

  it("replaces [Full Name] with the trimmed full name", () => {
    const result = buildShareText({
      template: "Sincerely, [Full Name]",
      userName: "  Ada Lovelace  ",
      url: URL,
    });

    expect(result).toBe(`Sincerely, Ada Lovelace\n\n${URL}`);
  });

  it("replaces every occurrence of a token, not just the first", () => {
    const result = buildShareText({
      template: "[First Name] says hi. [First Name] invites you.",
      userName: "Ada",
      url: URL,
    });

    expect(result).toBe(
      `Ada says hi. Ada invites you.\n\n${URL}`,
    );
  });

  it("handles a single-word name (first === full)", () => {
    const result = buildShareText({
      template: "[First Name] / [Full Name]",
      userName: "Ada",
      url: URL,
    });

    expect(result).toBe(`Ada / Ada\n\n${URL}`);
  });

  it("collapses multiple internal whitespace for the first-name split", () => {
    const result = buildShareText({
      template: "[First Name]!",
      userName: "Ada   Byron   Lovelace",
      url: URL,
    });

    expect(result).toBe(`Ada!\n\n${URL}`);
  });

  it("leaves tokens untouched when the userName is missing", () => {
    const resultUndefined = buildShareText({
      template: "Hi, [First Name]",
      url: URL,
    });
    const resultEmpty = buildShareText({
      template: "Hi, [First Name]",
      userName: "",
      url: URL,
    });
    const resultWhitespace = buildShareText({
      template: "Hi, [First Name]",
      userName: "   ",
      url: URL,
    });

    expect(resultUndefined).toBe(`Hi, [First Name]\n\n${URL}`);
    expect(resultEmpty).toBe(`Hi, [First Name]\n\n${URL}`);
    expect(resultWhitespace).toBe(`Hi, [First Name]\n\n${URL}`);
  });

  it("returns the url alone when the template is missing or empty after interpolation", () => {
    expect(
      buildShareText({ template: null, userName: "Ada", url: URL }),
    ).toBe(URL);
    expect(
      buildShareText({ template: "   ", userName: "Ada", url: URL }),
    ).toBe(URL);
  });
});
