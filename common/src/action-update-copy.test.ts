import { readGroupResults, RecognitionGroup } from "./action-update-copy";

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
