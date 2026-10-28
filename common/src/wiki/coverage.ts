import type { Nodes, TableCell, TableRow } from "mdast";
import { toString } from "mdast-util-to-string";
import { R, type Result } from "../result";
import { isTopicPath, PROVENANCE_DIR, WIKI_COVERAGE } from "./layout";
import {
  linksIn,
  nodePosition,
  type SourcePosition,
  type WikiDocument,
  type WikiProblem,
} from "./markdown";
import { LinkKind, resolveLink } from "./resolve";

export enum CoverageDisposition {
  Current = "current",
  Superseded = "superseded",
  Unimplemented = "unimplemented",
  ImplementationOnly = "implementation-only",
  Blocked = "blocked",
  Pending = "pending",
}

enum Evidence {
  Topics = "topics",
  Notes = "notes",
  None = "none",
}

const REQUIRED_EVIDENCE: Record<CoverageDisposition, Evidence> = {
  [CoverageDisposition.Current]: Evidence.Topics,
  [CoverageDisposition.Superseded]: Evidence.Notes,
  [CoverageDisposition.Unimplemented]: Evidence.Notes,
  [CoverageDisposition.ImplementationOnly]: Evidence.Notes,
  [CoverageDisposition.Blocked]: Evidence.Notes,
  [CoverageDisposition.Pending]: Evidence.None,
};

const DISPOSITIONS = new Set<string>(Object.values(CoverageDisposition));

function isDisposition(value: string): value is CoverageDisposition {
  return DISPOSITIONS.has(value);
}

const COVERAGE_COLUMNS = ["Record", "Disposition", "Topics", "Notes"];

export interface CoverageEntry {
  /** The provenance directory, e.g. `docs/provenance/<uuid>-<name>`. */
  record: string;
  dispositions: CoverageDisposition[];
  topics: string[];
  notes: string;
  position: SourcePosition;
}

export interface Coverage {
  entries: CoverageEntry[];
  problems: WikiProblem[];
}

function hasReferenceLink(node: Nodes): boolean {
  return (
    node.type === "linkReference" ||
    ("children" in node && node.children.some(hasReferenceLink))
  );
}

function localPaths(cell: TableCell): Result<string[], string> {
  if (hasReferenceLink(cell)) {
    return R.failure("use inline links in coverage cells");
  }
  const paths: string[] = [];
  for (const { url } of linksIn(cell)) {
    const resolved = resolveLink({ fromPath: WIKI_COVERAGE, url });
    if (!resolved.ok) return resolved;
    if (resolved.value.kind !== LinkKind.Local) {
      return R.failure(`"${url}" is not a repository link`);
    }
    paths.push(resolved.value.path);
  }
  return R.success(paths);
}

function provenanceDirectory(path: string): string | undefined {
  const prefix = `${PROVENANCE_DIR}/`;
  if (!path.startsWith(prefix)) return undefined;
  const name = path.slice(prefix.length).split("/")[0];
  return name ? `${prefix}${name}` : undefined;
}

function parseRecord(cell: TableCell): Result<string, string> {
  const paths = localPaths(cell);
  if (!paths.ok) return paths;
  const directories = new Set(paths.value.map(provenanceDirectory));
  const [record] = directories;
  if (directories.size !== 1 || record === undefined) {
    return R.failure(
      "the Record cell links one provenance directory or its files",
    );
  }
  return R.success(record);
}

function parseDispositions(
  cell: TableCell,
): Result<CoverageDisposition[], string> {
  const values = toString(cell)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  const dispositions = values.filter(isDisposition);
  if (values.length === 0 || dispositions.length !== values.length) {
    return R.failure(
      `dispositions are a comma-separated list of: ${[...DISPOSITIONS].join(", ")}`,
    );
  }
  if (new Set(dispositions).size !== dispositions.length) {
    return R.failure("each disposition appears once");
  }
  if (
    dispositions.includes(CoverageDisposition.Pending) &&
    dispositions.length > 1
  ) {
    return R.failure("pending cannot be combined with other dispositions");
  }
  return R.success(dispositions);
}

function parseTopics(cell: TableCell): Result<string[], string> {
  const paths = localPaths(cell);
  if (!paths.ok) return paths;
  const notTopic = paths.value.find((path) => !isTopicPath(path));
  if (notTopic !== undefined) {
    return R.failure(`the Topics cell links only topic pages, not ${notTopic}`);
  }
  return R.success(paths.value);
}

function parseRow(row: TableRow): Result<CoverageEntry, string> {
  const [recordCell, dispositionCell, topicsCell, notesCell] = row.children;
  if (row.children.length !== COVERAGE_COLUMNS.length || !notesCell) {
    return R.failure(`each row has ${COVERAGE_COLUMNS.length} cells`);
  }
  const record = parseRecord(recordCell);
  if (!record.ok) return record;
  const dispositions = parseDispositions(dispositionCell);
  if (!dispositions.ok) return dispositions;
  const topics = parseTopics(topicsCell);
  if (!topics.ok) return topics;
  const notes = toString(notesCell).trim();
  for (const disposition of dispositions.value) {
    const evidence = REQUIRED_EVIDENCE[disposition];
    switch (evidence) {
      case Evidence.Topics:
        if (topics.value.length === 0) {
          return R.failure(`${disposition} needs at least one topic page`);
        }
        break;
      case Evidence.Notes:
        if (notes === "") {
          return R.failure(
            `${disposition} needs notes explaining the disposition`,
          );
        }
        break;
      case Evidence.None:
        break;
      default:
        throw new Error(`unknown evidence: ${evidence satisfies never}`);
    }
  }
  return R.success({
    record: record.value,
    dispositions: dispositions.value,
    topics: topics.value,
    notes,
    position: nodePosition(row),
  });
}

export function parseCoverage(document: WikiDocument): Coverage {
  const problems: WikiProblem[] = [];
  const problem = (position: SourcePosition, message: string) =>
    problems.push({ path: WIKI_COVERAGE, position, message });

  const tables = document.tree.children.filter((node) => node.type === "table");
  const [table] = tables;
  if (tables.length !== 1 || table === undefined) {
    problem({ line: 1, column: 1 }, "coverage holds exactly one table");
    return { entries: [], problems };
  }
  const [header, ...rows] = table.children;
  const columns = header?.children.map((cell) => toString(cell).trim());
  if (columns?.join("|") !== COVERAGE_COLUMNS.join("|")) {
    problem(
      nodePosition(table),
      `coverage columns are: ${COVERAGE_COLUMNS.join(", ")}`,
    );
    return { entries: [], problems };
  }

  const entries: CoverageEntry[] = [];
  const seen = new Map<string, SourcePosition>();
  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed.ok) {
      problem(nodePosition(row), parsed.error);
      continue;
    }
    const earlier = seen.get(parsed.value.record);
    if (earlier !== undefined) {
      problem(
        parsed.value.position,
        `${parsed.value.record} already has a row at line ${earlier.line}`,
      );
      continue;
    }
    seen.set(parsed.value.record, parsed.value.position);
    entries.push(parsed.value);
  }
  return { entries, problems };
}
