import { parseCoverage } from "./coverage";
import {
  isTopicPath,
  PROVENANCE_DIR,
  WIKI_COVERAGE,
  WIKI_DIR,
  WIKI_INDEX,
} from "./layout";
import {
  parseWikiDocument,
  type WikiDocument,
  type WikiLink,
  type WikiProblem,
} from "./markdown";
import { LinkKind, resolveLink } from "./resolve";
import { parseWikiIndex } from "./wiki-index";

export enum EntryKind {
  File = "file",
  Directory = "directory",
}

/** Read access to a checkout, by repo-relative POSIX path. */
export interface RepoReader {
  kind(path: string): EntryKind | undefined;
  read(path: string): string;
  /** Entry names directly inside `dir`. */
  list(dir: string): string[];
}

export interface WikiCheckResult {
  problems: WikiProblem[];
  pageCount: number;
  recordCount: number;
}

const LINE_ANCHOR = /^L(\d+)(?:-L(\d+))?$/;

const MARKDOWN_EXTENSION = /\.(?:md|markdown)$/i;

function filesUnder(repo: RepoReader, dir: string): string[] {
  return repo.list(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    const kind = repo.kind(path);
    switch (kind) {
      case EntryKind.Directory:
        return filesUnder(repo, path);
      case EntryKind.File:
        return [path];
      case undefined:
        throw new Error(`${path} is listed but has no kind`);
      default:
        throw new Error(`unknown entry kind: ${kind satisfies never}`);
    }
  });
}

function lineCount(text: string): number {
  if (text === "") return 0;
  const lines = text.split("\n").length;
  return text.endsWith("\n") ? lines - 1 : lines;
}

function createDocuments(repo: RepoReader) {
  const cache = new Map<string, WikiDocument>();
  return (path: string): WikiDocument => {
    let document = cache.get(path);
    if (document === undefined) {
      document = parseWikiDocument(repo.read(path));
      cache.set(path, document);
    }
    return document;
  };
}

function checkLink({
  repo,
  documents,
  fromPath,
  link,
}: {
  repo: RepoReader;
  documents: (path: string) => WikiDocument;
  fromPath: string;
  link: WikiLink;
}): string | undefined {
  const resolved = resolveLink({ fromPath, url: link.url });
  if (!resolved.ok) return resolved.error;
  if (resolved.value.kind === LinkKind.External) return undefined;
  const { path, fragment } = resolved.value;
  const kind = repo.kind(path);
  switch (kind) {
    case undefined:
      return `broken link: ${path} does not exist`;
    case EntryKind.Directory:
      return fragment === undefined
        ? undefined
        : `"${link.url}" puts a fragment on a directory`;
    case EntryKind.File:
      break;
    default:
      throw new Error(`unknown entry kind: ${kind satisfies never}`);
  }
  if (fragment === undefined) return undefined;
  if (path.endsWith(".md")) {
    return documents(path).headings.some((h) => h.id === fragment)
      ? undefined
      : `no heading #${fragment} in ${path}`;
  }
  const lines = LINE_ANCHOR.exec(fragment);
  if (lines === null) {
    return `"${link.url}" cites a source file with a fragment other than #L<n> or #L<n>-L<m>`;
  }
  const start = Number(lines[1]);
  const end = Number(lines[2] ?? lines[1]);
  if (start < 1 || start > end) {
    return `"${link.url}" cites an empty or reversed line range`;
  }
  const total = lineCount(repo.read(path));
  return end <= total
    ? undefined
    : `lines ${start}-${end} are outside ${path}, which has ${total}`;
}

/** Structural checks only; whether a page explains its sources correctly is left to review. */
export function checkWiki(repo: RepoReader): WikiCheckResult {
  const problems: WikiProblem[] = [];
  for (const required of [WIKI_INDEX, WIKI_COVERAGE]) {
    if (repo.kind(required) !== EntryKind.File) {
      problems.push({
        path: required,
        position: { line: 1, column: 1 },
        message: "required wiki file is missing",
      });
    }
  }
  if (problems.length > 0) return { problems, pageCount: 0, recordCount: 0 };

  const documents = createDocuments(repo);
  const files = filesUnder(repo, WIKI_DIR);
  for (const path of files) {
    if (MARKDOWN_EXTENSION.test(path) && !path.endsWith(".md")) {
      problems.push({
        path,
        position: { line: 1, column: 1 },
        message: "wiki pages use the .md extension",
      });
    }
  }
  const pages = files.filter((path) => path.endsWith(".md"));
  for (const path of pages) {
    const document = documents(path);
    if (document.title === undefined) {
      problems.push({
        path,
        position: { line: 1, column: 1 },
        message: "a wiki page starts with a level-one title",
      });
    }
    for (const position of document.htmlLinks) {
      problems.push({
        path,
        position,
        message: "use Markdown link syntax so wikicheck can check this link",
      });
    }
    for (const link of document.links) {
      const message = checkLink({ repo, documents, fromPath: path, link });
      if (message !== undefined) {
        problems.push({ path, position: link.position, message });
      }
    }
  }

  // Any index or ledger problem defers its completeness check, since a malformed entry or row would otherwise also read as missing.
  const index = parseWikiIndex(documents(WIKI_INDEX));
  problems.push(...index.problems);
  const listed = new Set(
    index.groups.flatMap((group) => group.entries.map((entry) => entry.path)),
  );
  for (const path of pages.filter(isTopicPath)) {
    if (index.problems.length === 0 && !listed.has(path)) {
      problems.push({
        path: WIKI_INDEX,
        position: { line: 1, column: 1 },
        message: `${path} is not listed in the index`,
      });
    }
  }

  const coverage = parseCoverage(documents(WIKI_COVERAGE));
  problems.push(...coverage.problems);
  for (const entry of coverage.entries) {
    if (repo.kind(entry.record) === EntryKind.File) {
      problems.push({
        path: WIKI_COVERAGE,
        position: entry.position,
        message: `${entry.record} is not a provenance directory`,
      });
    }
  }
  const covered = new Set(coverage.entries.map((entry) => entry.record));
  const records = repo
    .list(PROVENANCE_DIR)
    .map((name) => `${PROVENANCE_DIR}/${name}`)
    .filter((path) => repo.kind(path) === EntryKind.Directory);
  for (const record of records) {
    if (coverage.problems.length === 0 && !covered.has(record)) {
      problems.push({
        path: WIKI_COVERAGE,
        position: { line: 1, column: 1 },
        message: `${record} has no coverage row; add one with dispositions per skills/wiki/SKILL.md#change-with-the-code`,
      });
    }
  }

  return { problems, pageCount: pages.length, recordCount: records.length };
}
