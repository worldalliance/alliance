import { type Candidate, pickNext } from "./kora-assignment-pick";

const first = () => 0;
const c = (id: string, category: string, deficit = 1): Candidate => ({
  id,
  category,
  deficit,
});

describe("pickNext", () => {
  it("prefers the transcript closest to its review target", () => {
    const picked = pickNext({
      candidates: [c("far", "b", 3), c("near", "a", 1), c("mid", "c", 2)],
      bound: [],
      random: first,
    });
    expect(picked?.id).toBe("near");
  });

  it("stays on the last topic until the assignment has three from it", () => {
    const candidates = [c("a2", "a", 1), c("b1", "b", 5)];
    expect(pickNext({ candidates, bound: ["a"], random: first })?.id).toBe(
      "a2",
    );
    expect(
      pickNext({ candidates, bound: ["a", "a", "a"], random: first })?.id,
    ).toBe("b1");
  });

  it("leaves capped categories for others, then takes them rather than end early", () => {
    const capped = c("a4", "a", 9);
    const bound = ["a", "a", "a", "b"];
    expect(
      pickNext({
        candidates: [capped, c("c1", "c", 1)],
        bound: ["b", ...bound],
        random: first,
      })?.id,
    ).toBe("c1");
    expect(pickNext({ candidates: [capped], bound, random: first })?.id).toBe(
      "a4",
    );
  });

  it("picks among equally close transcripts at random", () => {
    const candidates = [c("x", "a", 2), c("y", "b", 2), c("z", "c", 4)];
    const ids = [0, 0.99].map(
      (r) => pickNext({ candidates, bound: [], random: () => r })?.id,
    );
    expect(ids).toEqual(["x", "y"]);
  });

  it("returns null when nothing is left", () => {
    expect(pickNext({ candidates: [], bound: [], random: first })).toBeNull();
  });
});
