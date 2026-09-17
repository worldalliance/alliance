import chroma from "chroma-js";
import { swatchColors, swatchGradient } from "./identitySwatch";

const SEEDS = [
  "field-1774033897472",
  "field-1774396629695",
  "block-1789523333513",
  "snapshot-511",
  "snapshot-512",
  "Default",
  "Variant B",
  "",
];

describe("swatchColors", () => {
  it("returns the same pair for the same seed", () => {
    for (const seed of SEEDS) {
      expect(swatchColors(seed)).toEqual(swatchColors(seed));
    }
  });

  it("returns a different pair for a different seed", () => {
    const seen = new Set(
      SEEDS.map((seed) => {
        const { from, to } = swatchColors(seed);
        return `${from}/${to}`;
      }),
    );

    expect(seen.size).toBe(SEEDS.length);
  });

  it("separates ids that differ by one character", () => {
    const a = swatchColors("field-1774033897472");
    const b = swatchColors("field-1774033897473");

    expect(chroma.deltaE(a.from, b.from)).toBeGreaterThan(10);
  });

  it("spreads a hundred ids around the hue circle", () => {
    const quadrants = new Set<number>();
    for (let index = 0; index < 100; index++) {
      const [hue] = chroma(swatchColors(`field-${index}`).from).hsl();
      quadrants.add(Math.floor(hue / 90));
    }

    expect(quadrants.size).toBe(4);
  });

  it("stays pastel", () => {
    for (let index = 0; index < 100; index++) {
      const { from, to } = swatchColors(`field-${index}`);
      expect(chroma(from).luminance()).toBeGreaterThan(0.3);
      expect(chroma(to).luminance()).toBeGreaterThan(0.2);
    }
  });
});

describe("swatchGradient", () => {
  it("builds a css gradient from the seed's colours", () => {
    const { from, to } = swatchColors("field-1");

    expect(swatchGradient("field-1")).toBe(
      `linear-gradient(135deg, ${from}, ${to})`,
    );
  });
});
