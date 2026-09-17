export const normalizeQuery = (query: string): string =>
  query.trim().toLowerCase();

export function matchesQuery(params: {
  texts: readonly string[];
  query: string;
}): boolean {
  const query = normalizeQuery(params.query);
  if (!query) return true;
  return params.texts.some((text) => text.toLowerCase().includes(query));
}

export type HighlightSegment = { text: string; match: boolean };

/** `text` split so every occurrence of `query` is its own marked segment. */
export function highlightSegments(params: {
  text: string;
  query: string;
}): HighlightSegment[] {
  const { text } = params;
  const query = normalizeQuery(params.query);
  if (!query || !text) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (
    let found = haystack.indexOf(query);
    found !== -1;
    found = haystack.indexOf(query, cursor)
  ) {
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false });
    }
    segments.push({
      text: text.slice(found, found + query.length),
      match: true,
    });
    cursor = found + query.length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments;
}
