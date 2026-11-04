import { readGroupResults, RecognitionGroup } from "./action-update-copy";

describe("readGroupResults", () => {
  it("gives uninvolved members the didn't-complete text", () => {
    expect(
      readGroupResults({
        completed: " a hearing ",
        didNotComplete: " a hearing without you ",
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: "a hearing",
        [RecognitionGroup.DidNotComplete]: "a hearing without you",
        [RecognitionGroup.Uninvolved]: "a hearing without you",
      },
    });
  });

  it("skips each empty group, but not both", () => {
    expect(
      readGroupResults({
        completed: "",
        didNotComplete: "a hearing without you",
      }),
    ).toEqual({
      ok: true,
      value: {
        [RecognitionGroup.Completed]: null,
        [RecognitionGroup.DidNotComplete]: "a hearing without you",
        [RecognitionGroup.Uninvolved]: "a hearing without you",
      },
    });
    expect(
      readGroupResults({
        completed: "",
        didNotComplete: " ",
      }),
    ).toEqual({ ok: false, error: "Write at least one group's result." });
  });
});
