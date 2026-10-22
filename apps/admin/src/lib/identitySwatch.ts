import chroma from "chroma-js";

export type SwatchColors = { from: string; to: string };

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashString(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Two pastel endpoints for a gradient, derived from `seed` alone. Stable across
 * reloads and machines, so the same identifier keeps its colours everywhere.
 */
export function swatchColors(seed: string): SwatchColors {
  const hash = hashString(seed);
  const hue = hash % 360;
  const spread = 25 + ((hash >>> 9) % 65);
  const saturation = 0.45 + ((hash >>> 17) % 31) / 100;
  const lightness = 0.74 + ((hash >>> 24) % 9) / 100;
  return {
    from: chroma.hsl(hue, saturation, lightness).hex(),
    to: chroma.hsl((hue + spread) % 360, saturation, lightness - 0.08).hex(),
  };
}

export function swatchGradient(seed: string): string {
  const { from, to } = swatchColors(seed);
  return `linear-gradient(135deg, ${from}, ${to})`;
}
