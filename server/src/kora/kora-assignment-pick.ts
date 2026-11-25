export type Candidate = { id: string; category: string; deficit: number };

export const MAX_PER_CATEGORY = 3;

/**
 * Picks the next transcript for an assignment that already holds `bound`
 * categories, in the order given. Stays in the last category while the
 * assignment has fewer than MAX_PER_CATEGORY from it, so pairs on a topic come
 * together; otherwise takes the transcript closest to its review target, so
 * transcripts finish their reviews one after another rather than all at the
 * end, from a category under the cap unless only capped ones are left.
 */
export function pickNext<C extends Candidate>(params: {
  candidates: C[];
  bound: string[];
  random: () => number;
}): C | null {
  const counts = new Map<string, number>();
  for (const category of params.bound) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const underCap = (c: C) => (counts.get(c.category) ?? 0) < MAX_PER_CATEGORY;
  const last = params.bound.at(-1);
  const sameTopic = params.candidates.filter(
    (c) => c.category === last && underCap(c),
  );
  const open = params.candidates.filter(underCap);
  const pool = sameTopic.length
    ? sameTopic
    : open.length
      ? open
      : params.candidates;
  const fewest = Math.min(...pool.map((c) => c.deficit));
  const closest = pool.filter((c) => c.deficit === fewest);
  return closest[Math.floor(params.random() * closest.length)] ?? null;
}
