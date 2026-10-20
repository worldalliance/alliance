import { hashStringToSeed } from "@alliance/common/random";

const createMulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffleWithSeed = <T>(items: T[], seed: string): T[] => {
  if (items.length <= 1) return items.slice();
  const result = items.slice();
  const random = createMulberry32(hashStringToSeed(seed));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
