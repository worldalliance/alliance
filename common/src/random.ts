const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const hashStringToSeed = (input: string): number => {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

/**
 * Like `hashStringToSeed`, but every bit depends on the whole input, so
 * `uniformHash(s) % n` is uniform for any `n`. A raw FNV-1a hash's low bits
 * depend only on the low bits of each character.
 */
export const uniformHash = (input: string): number => {
  let hash = hashStringToSeed(input);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
};
