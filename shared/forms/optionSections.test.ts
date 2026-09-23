import {
  filterOptionSections,
  type OptionSection,
  optionSections,
} from "./optionSections";
import { shuffleWithSeed } from "./randomutils";

const categories = [
  { id: "fruit", name: "Fruit" },
  { id: "empty", name: "Empty" },
  { id: "veg", name: "Légumes" },
];
const options = [
  { label: "Kale", value: "kale", category: "veg" },
  { label: "Apple", value: "apple", category: "fruit" },
  { label: "Other", value: "other" },
  { label: "Banana", value: "banana", category: "fruit" },
  { label: "Leek", value: "leek", category: "veg" },
  { label: "None", value: "none" },
];

const summary = (
  sections: OptionSection<{ value: string }>[],
): [string | null, string[]][] =>
  sections.map((section) => [
    section.category?.name ?? null,
    section.items.map((option) => option.value),
  ]);

describe("optionSections", () => {
  it("puts uncategorized options first and omits empty categories", () => {
    expect(summary(optionSections({ options, categories }))).toEqual([
      [null, ["other", "none"]],
      ["Fruit", ["apple", "banana"]],
      ["Légumes", ["kale", "leek"]],
    ]);
  });

  it("keeps options naming a missing category in the uncategorized section", () => {
    expect(
      summary(
        optionSections({
          options: [
            { value: "apple", category: "fruit" },
            { value: "orphan", category: "deleted" },
          ],
          categories,
        }),
      ),
    ).toEqual([
      [null, ["orphan"]],
      ["Fruit", ["apple"]],
    ]);
  });

  it("returns one headingless section for a field without categories", () => {
    const flat = options.map(({ label, value }) => ({ label, value }));
    expect(optionSections({ options: flat })).toEqual([
      { category: null, items: flat },
    ]);
  });

  it("shuffles only within sections, stably for a seed", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      label: `${index}`,
      value: `${index}`,
      category: index % 3 === 0 ? undefined : index % 3 === 1 ? "fruit" : "veg",
    }));
    const authored = summary(optionSections({ options: many, categories }));
    const shuffled = summary(
      optionSections({ options: many, categories, shuffleSeed: "seed" }),
    );

    expect(shuffled).not.toEqual(authored);
    expect(shuffled.map(([name]) => name)).toEqual([null, "Fruit", "Légumes"]);
    shuffled.forEach(([, values], index) => {
      expect([...values].sort()).toEqual([...authored[index][1]].sort());
    });
    expect(
      summary(
        optionSections({ options: many, categories, shuffleSeed: "seed" }),
      ),
    ).toEqual(shuffled);
  });

  it("shuffles a field without categories as a flat list", () => {
    const flat = options.map(({ label, value }) => ({ label, value }));
    expect(optionSections({ options: flat, shuffleSeed: "seed" })).toEqual([
      { category: null, items: shuffleWithSeed(flat, "seed") },
    ]);
  });
});

describe("filterOptionSections", () => {
  const sections = optionSections({ options, categories });
  const filter = (query: string) =>
    summary(
      filterOptionSections(sections, {
        query,
        text: (option) => option.label,
      }),
    );

  it("keeps matching options under their headings", () => {
    expect(filter("an")).toEqual([["Fruit", ["banana"]]]);
    expect(filter("e")).toEqual([
      [null, ["other", "none"]],
      ["Fruit", ["apple"]],
      ["Légumes", ["kale", "leek"]],
    ]);
  });

  it("keeps a whole category whose name matches, once", () => {
    expect(filter("  FRUIT ")).toEqual([["Fruit", ["apple", "banana"]]]);
    expect(filter("legumes")).toEqual([["Légumes", ["kale", "leek"]]]);
    expect(filter("gum")).toEqual([["Légumes", ["kale", "leek"]]]);
    expect(filter("l")).toEqual([
      ["Fruit", ["apple"]],
      ["Légumes", ["kale", "leek"]],
    ]);
  });

  it("returns no sections without matches and all of them for a blank query", () => {
    expect(filter("zzz")).toEqual([]);
    expect(filter("  ")).toEqual(summary(sections));
  });
});
