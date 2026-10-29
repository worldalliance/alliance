import { describe, expect, it } from "bun:test";
import { findTextIssues, TextIssueKind } from "./textChecks";

const flagged = (text: string, isKnownWord?: (word: string) => boolean) =>
  findTextIssues(text, isKnownWord).map((issue) => ({
    kind: issue.kind,
    text: text.slice(issue.start, issue.end),
  }));

describe("findTextIssues", () => {
  it("flags spaces repeated between words", () => {
    expect(flagged("Call  your rep.")).toEqual([
      { kind: TextIssueKind.DoubleSpace, text: "  " },
    ]);
  });

  it("leaves markdown hard breaks and indentation alone", () => {
    expect(flagged("First line  \nSecond line\n    indented")).toEqual([]);
  });

  it("flags a word repeated back to back, ignoring case", () => {
    expect(flagged("Sign the The petition")).toEqual([
      { kind: TextIssueKind.RepeatedWord, text: "the The" },
    ]);
  });

  it("flags punctuation spacing", () => {
    expect(flagged("Call today , then write.Then rest.")).toEqual([
      { kind: TextIssueKind.SpaceBeforePunctuation, text: " ," },
      { kind: TextIssueKind.MissingSpaceAfterPunctuation, text: "." },
    ]);
  });

  it("skips links, code, html, and email addresses", () => {
    expect(
      flagged(
        "See [the  page](https://example.org/a.Bc  x) or `a  b` or <a  href> or hi@example.org.Nope",
      ),
    ).toEqual([{ kind: TextIssueKind.DoubleSpace, text: "  " }]);
  });

  it("flags lowercase words the dictionary lacks, skipping capitalized and short words", () => {
    const known = new Set(["call", "your", "today", "member"]);
    expect(
      flagged("Call yuor Senator today, membr's ok", (word) => known.has(word)),
    ).toEqual([
      { kind: TextIssueKind.Misspelling, text: "yuor" },
      { kind: TextIssueKind.Misspelling, text: "membr's" },
    ]);
  });

  it("checks a contraction with a curly apostrophe as a whole word", () => {
    const known = new Set(["isn't", "the", "member"]);
    expect(flagged("It isn’t the member’s", (word) => known.has(word))).toEqual(
      [],
    );
  });

  it("skips code fence labels and file names, still checking a caption", () => {
    expect(
      flagged("```imgcap\n1762827853197.webp\nA pothoel\n```", (word) =>
        ["pothole"].includes(word),
      ),
    ).toEqual([{ kind: TextIssueKind.Misspelling, text: "pothoel" }]);
  });

  it("skips bare www links and domains", () => {
    expect(flagged("Visit www.example.org", () => false)).toEqual([]);
    expect(flagged("Visit thealliance.org", () => false)).toEqual([]);
  });

  it("flags placeholder text left in", () => {
    expect(
      flagged("Call TODO by Friday, link [insert link here], lorem ipsum."),
    ).toEqual([
      { kind: TextIssueKind.Placeholder, text: "TODO" },
      { kind: TextIssueKind.Placeholder, text: "[insert link here]" },
      { kind: TextIssueKind.Placeholder, text: "lorem ipsum" },
    ]);
  });

  it("checks no spelling without a dictionary", () => {
    expect(flagged("yuor")).toEqual([]);
  });
});
