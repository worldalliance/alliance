import { type Candidate, pickAssignment } from "./kora-assignment-pick";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const c = (id: string, category: string, deficit = 1): Candidate => ({
  id,
  category,
  deficit,
});
const categoriesOf = (picked: Candidate[]) => picked.map((p) => p.category);

describe("pickAssignment", () => {
  it("prefers transcripts furthest from their review target", () => {
    const picked = pickAssignment({
      candidates: [c("near", "a", 1), c("far", "b", 3), c("mid", "c", 2)],
      size: 2,
      random: seeded(1),
    });
    expect(picked.map((p) => p.id).sort()).toEqual(["far", "mid"]);
  });

  it("takes at most three from a category while others can fill the assignment", () => {
    const candidates = [
      ...["a1", "a2", "a3", "a4", "a5"].map((id) => c(id, "a", 5)),
      c("b1", "b"),
      c("c1", "c"),
    ];
    const picked = pickAssignment({ candidates, size: 5, random: seeded(2) });
    expect(categoriesOf(picked).filter((x) => x === "a")).toHaveLength(3);
    expect(picked).toHaveLength(5);
  });

  it("goes past three per category rather than hand out a short assignment", () => {
    const candidates = ["a1", "a2", "a3", "a4", "a5"].map((id) => c(id, "a"));
    expect(
      pickAssignment({ candidates, size: 5, random: seeded(3) }),
    ).toHaveLength(5);
  });

  it("groups transcripts by category, in an order that varies by reviewer", () => {
    const candidates = ["a", "b", "c", "d"].flatMap((cat) =>
      [1, 2].map((n) => c(`${cat}${n}`, cat)),
    );
    const orders = new Set<string>();
    for (let seed = 1; seed < 20; seed++) {
      const cats = categoriesOf(
        pickAssignment({ candidates, size: 8, random: seeded(seed) }),
      );
      const runs = cats.filter((cat, i) => cat !== cats[i - 1]);
      expect(runs).toHaveLength(4);
      orders.add(runs.join(""));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("returns what there is when the pool is smaller than the assignment", () => {
    expect(
      pickAssignment({
        candidates: [c("x", "a")],
        size: 10,
        random: seeded(4),
      }),
    ).toHaveLength(1);
  });
});
