import {
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  slugCandidates,
  slugFromName,
} from "./slug";

const take = (gen: Generator<string>, n: number) =>
  Array.from({ length: n }, () => gen.next().value);

describe("slugFromName", () => {
  it.each([
    ["Find your utility's discount", "find-your-utilitys-discount"],
    ["Café & Crème — 2026!", "cafe-and-creme-2026"],
    ["  --spaced  out--  ", "spaced-out"],
    ["a -- b", "a-b"],
  ])("slugifies %j to %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it.each(["🎉🎉", "日本語", "", "!!!"])(
    "returns null when %j has nothing to keep",
    (name) => {
      expect(slugFromName(name)).toBeNull();
    },
  );

  it("cuts a long name at the last hyphen that fits", () => {
    const name = Array.from({ length: 20 }, () => "word").join(" ");
    const slug = slugFromName(name);
    expect(slug).toBe(Array.from({ length: 16 }, () => "word").join("-"));
    expect(slug?.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });

  it("keeps a slug of exactly the max length whole", () => {
    const name = "a".repeat(SLUG_MAX_LENGTH);
    expect(slugFromName(name)).toBe(name);
  });

  it("hard-cuts a single word longer than the max", () => {
    expect(slugFromName("a".repeat(100))).toBe("a".repeat(SLUG_MAX_LENGTH));
  });
});

describe("slugCandidates", () => {
  it("yields the base, then numbered suffixes", () => {
    expect(take(slugCandidates("food-bank"), 3)).toEqual([
      "food-bank",
      "food-bank-2",
      "food-bank-3",
    ]);
  });

  it("drops trailing words so a suffix fits", () => {
    const base = Array.from({ length: 16 }, () => "word").join("-");
    const [, second] = take(slugCandidates(base), 2);
    expect(second).toBe(
      Array.from({ length: 15 }, () => "word").join("-") + "-2",
    );
    expect(second.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(second).toMatch(SLUG_PATTERN);
  });

  it("hard-cuts a single max-length word so a suffix fits", () => {
    const [, second] = take(slugCandidates("a".repeat(SLUG_MAX_LENGTH)), 2);
    expect(second).toBe("a".repeat(SLUG_MAX_LENGTH - 2) + "-2");
  });
});
