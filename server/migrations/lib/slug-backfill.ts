// Frozen copy of the slug rules in `src/utils/slug.ts` as they stood when the
// ActionProjectSlug migration first ran. It lives outside `migrations/*.ts`
// because TypeORM instantiates every export it finds there. Application code
// must not import it, and its behavior must not change.
import slugify from "slugify";

const MAX_LENGTH = 80;

function truncate(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1).lastIndexOf("-");
  return cut > 0 ? slug.slice(0, cut) : slug.slice(0, maxLength);
}

export type SlugRow = { id: number; name: string; deleted: boolean };

/**
 * A slug per row, in id order so the oldest of a set of same-named rows keeps
 * the unsuffixed slug. Only live rows reserve a slug, matching the partial
 * unique index.
 */
export function backfillSlugs(params: {
  table: string;
  rows: SlugRow[];
}): Map<number, string> {
  const taken = new Set<string>();
  const slugs = new Map<number, string>();
  for (const row of [...params.rows].sort((a, b) => a.id - b.id)) {
    const base =
      truncate(
        slugify(row.name, { lower: true, strict: true, trim: true }),
        MAX_LENGTH,
      ) || `${params.table}-${row.id}`;
    let slug = base;
    for (let n = 2; taken.has(slug); n++) {
      const suffix = `-${n}`;
      slug = truncate(base, MAX_LENGTH - suffix.length) + suffix;
    }
    if (!row.deleted) taken.add(slug);
    slugs.set(row.id, slug);
  }
  return slugs;
}
