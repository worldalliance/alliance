import {
  firstSentence,
  readGroupResults,
  RecognitionGroup,
} from "./action-update-copy";

describe("readGroupResults", () => {
  it("gives every group the collective result until it's split", () => {
    expect(
      readGroupResults({
        split: false,
        completed: " a hearing ",
        didNotComplete: "unused",
        uninvolved: null,
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: "a hearing",
        [RecognitionGroup.DidNotComplete]: "a hearing",
        [RecognitionGroup.Uninvolved]: "a hearing",
      },
    });
  });

  it("requires the collective result until it's split", () => {
    expect(
      readGroupResults({
        split: false,
        completed: " ",
        didNotComplete: "a hearing",
        uninvolved: "a hearing",
      }),
    ).toEqual({ ok: false, error: "Write the collective result." });
  });

  it("skips each empty split group, but not all three", () => {
    expect(
      readGroupResults({
        split: true,
        completed: "",
        didNotComplete: "a hearing without you",
        uninvolved: null,
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: null,
        [RecognitionGroup.DidNotComplete]: "a hearing without you",
        [RecognitionGroup.Uninvolved]: null,
      },
    });
    expect(
      readGroupResults({
        split: true,
        completed: "",
        didNotComplete: " ",
        uninvolved: null,
      }),
    ).toEqual({ ok: false, error: "Write at least one group's result." });
  });
});

describe("firstSentence", () => {
  it("stops at the first sentence end followed by whitespace", () => {
    expect(firstSentence("We won 3.5 seats. Then more!")).toBe(
      "We won 3.5 seats.",
    );
    expect(firstSentence("No ending")).toBe("No ending");
  });

  it("reads past abbreviations", () => {
    expect(
      firstSentence("Your 3 letters led to Dr. Lee's testimony. More soon."),
    ).toBe("Your 3 letters led to Dr. Lee's testimony.");
    expect(firstSentence("Sen. Smith voted yes! Great.")).toBe(
      "Sen. Smith voted yes!",
    );
  });

  it("reads past the abbreviations civic copy names mid-sentence", () => {
    expect(firstSentence("the U.S. Senate passing the bill. More soon.")).toBe(
      "the U.S. Senate passing the bill.",
    );
    expect(firstSentence("Prop. 50 passing. More.")).toBe("Prop. 50 passing.");
    expect(firstSentence("a hearing in the U.K. Parliament. Next.")).toBe(
      "a hearing in the U.K. Parliament.",
    );
  });

  it("reads past bill numbers", () => {
    expect(firstSentence("a vote on H.R. 1")).toBe("a vote on H.R. 1");
    expect(firstSentence("A.B. 5 passing. Thanks!")).toBe("A.B. 5 passing.");
    expect(firstSentence("S.B. 54 passing. Next.")).toBe("S.B. 54 passing.");
  });

  it("ends a sentence at a number", () => {
    expect(firstSentence("a hearing on Oct. 5. More soon.")).toBe(
      "a hearing on Oct. 5.",
    );
    expect(firstSentence("we sent 500. Thanks!")).toBe("we sent 500.");
    expect(firstSentence("A.B. 5. More soon.")).toBe("A.B. 5.");
  });

  it("ends a sentence even when the next one starts lowercase", () => {
    expect(
      firstSentence("2 weeks ago you sent 3 letters. a hearing on the bill."),
    ).toBe("2 weeks ago you sent 3 letters.");
  });
});
