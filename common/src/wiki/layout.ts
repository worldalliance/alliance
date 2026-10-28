export const WIKI_DIR = "docs/wiki";
export const WIKI_INDEX = `${WIKI_DIR}/index.md`;
export const WIKI_COVERAGE = `${WIKI_DIR}/coverage.md`;

/** A page the index lists and coverage entries cite; the index and the ledger themselves are not topics. */
export function isTopicPath(path: string): boolean {
  return (
    path.startsWith(`${WIKI_DIR}/`) &&
    path.endsWith(".md") &&
    path !== WIKI_INDEX &&
    path !== WIKI_COVERAGE
  );
}
