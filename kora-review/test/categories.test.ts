import { describe, expect, it } from "bun:test";
import { CATEGORIES } from "../src/categories.js";
import { KoraCategory } from "../src/index.js";

const taxonomy = Bun.YAML.parse(
  await Bun.file(
    new URL("../../docs/kora/categories_and_risks.yaml", import.meta.url),
  ).text(),
);
if (!Array.isArray(taxonomy)) throw new Error("taxonomy is not a list");
const extraWarnings = new Set<string>([
  KoraCategory.Violence,
  KoraCategory.FearTrauma,
]);

describe("categories", () => {
  it("are KORA's 26 risks, in taxonomy order", () => {
    const ids = taxonomy.map((r) => r.id);
    expect(ids).toHaveLength(26);
    expect<string[]>(Object.values(KoraCategory)).toEqual(ids);
    expect<string[]>(CATEGORIES.map((c) => c.id)).toEqual(ids);
  });

  it("warn on every hard risk, and on violence and fear", () => {
    for (const risk of taxonomy) {
      const category = CATEGORIES.find((c) => c.id === risk.id);
      expect(category?.sensitive, risk.id).toBe(
        risk.hard === true || extraWarnings.has(risk.id),
      );
      if (category?.sensitive) expect(category.description).toBeTruthy();
    }
  });
});
