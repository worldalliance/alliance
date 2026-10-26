import slugify from "slugify";

export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function truncate(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1).lastIndexOf("-");
  return cut > 0 ? slug.slice(0, cut) : slug.slice(0, maxLength);
}

export function slugFromName(name: string): string | null {
  const slug = truncate(
    slugify(name, { lower: true, strict: true, trim: true }),
    SLUG_MAX_LENGTH,
  );
  return slug === "" ? null : slug;
}

export function* slugCandidates(base: string): Generator<string> {
  yield base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    yield truncate(base, SLUG_MAX_LENGTH - suffix.length) + suffix;
  }
}
