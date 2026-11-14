export type Candidate = { id: string; category: string; deficit: number };

export const MAX_PER_CATEGORY = 3;

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks up to `size` transcripts, those furthest from their review target
 * first, at most MAX_PER_CATEGORY per category unless that leaves the
 * assignment short. Returns them grouped by category, groups in random order.
 */
export function pickAssignment<C extends Candidate>(params: {
  candidates: C[];
  size: number;
  random: () => number;
}): C[] {
  const { size, random } = params;
  const ranked = shuffle(params.candidates, random).sort(
    (a, b) => b.deficit - a.deficit,
  );
  const picked: C[] = [];
  const perCategory = new Map<string, number>();
  for (const c of ranked) {
    if (picked.length === size) break;
    const count = perCategory.get(c.category) ?? 0;
    if (count < MAX_PER_CATEGORY) {
      picked.push(c);
      perCategory.set(c.category, count + 1);
    }
  }
  for (const c of ranked) {
    if (picked.length === size) break;
    if (!picked.includes(c)) picked.push(c);
  }
  const groups = new Map<string, C[]>();
  for (const c of picked) {
    groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  }
  return shuffle([...groups.values()], random).flat();
}
