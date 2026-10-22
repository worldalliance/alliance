import { decodeHTML } from "entities";
import ts from "typescript";

export type CopyOccurrence = { file: string; line: number };
export type RepeatedCopy = { text: string; occurrences: CopyOccurrence[] };

const MIN_WORDS = 5;
const STYLE_CALLS = new Set(["cn", "clsx", "twMerge", "cva"]);

function normalize(text: string): string {
  return decodeHTML(text)
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function isStyling(node: ts.Node): boolean {
  for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isJsxAttribute(p))
      return /className$|^style$/.test(p.name.getText());
    if (ts.isCallExpression(p) && STYLE_CALLS.has(p.expression.getText()))
      return true;
    if (ts.isPropertyAssignment(p) && /className$/i.test(p.name.getText()))
      return true;
  }
  return false;
}

function enclosingAttribute(node: ts.Node): ts.JsxAttribute | undefined {
  for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isJsxAttribute(p)) return p;
    if (
      ts.isJsxElement(p) ||
      ts.isJsxSelfClosingElement(p) ||
      ts.isFunctionLike(p)
    )
      return undefined;
  }
  return undefined;
}

function looksLikeClassList(text: string): boolean {
  const words = text.split(" ");
  return (
    words.every((w) => /^[a-z0-9:/[\]._%!#(),-]+$/.test(w)) &&
    words.filter((w) => /[-:]/.test(w)).length * 2 >= words.length
  );
}

const IGNORE_START = /^\s*(\/\/|\/\*|\{\/\*)\s*jscpd:ignore-start/;
const IGNORE_END = /^\s*(\/\/|\/\*|\{\/\*)\s*jscpd:ignore-end/;

function ignoredLines(source: string): Set<number> {
  const ignored = new Set<number>();
  let inside = false;
  source.split("\n").forEach((line, i) => {
    if (IGNORE_START.test(line)) inside = true;
    if (inside) ignored.add(i + 1);
    if (IGNORE_END.test(line)) inside = false;
  });
  return ignored;
}

function extractCopy(file: string, source: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const ignored = ignoredLines(source);
  const perElement = new Map<ts.Node, Set<string>>();
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );

  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) ||
        ts.isJsxText(node)) &&
      !isStyling(node)
    ) {
      const text = normalize(node.text);
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const attributes = enclosingAttribute(node)?.parent;
      const seenOnElement = attributes && perElement.get(attributes);
      if (
        text.split(" ").length >= MIN_WORDS &&
        /[a-z]/i.test(text) &&
        !looksLikeClassList(text) &&
        !ignored.has(line) &&
        !seenOnElement?.has(text)
      ) {
        found.set(text, [...(found.get(text) ?? []), line]);
        if (attributes) {
          perElement.set(attributes, new Set([...(seenOnElement || []), text]));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function indexCopy(files: Map<string, string>): Map<string, CopyOccurrence[]> {
  const index = new Map<string, CopyOccurrence[]>();
  for (const [file, source] of files) {
    for (const [text, lines] of extractCopy(file, source)) {
      const occurrences = lines.map((line) => ({ file, line }));
      index.set(text, [...(index.get(text) ?? []), ...occurrences]);
    }
  }
  return index;
}

/**
 * Text of at least five words that appears more than once in `current` and
 * more often than in `base`, so a moved file is not a new repeat. Both maps are
 * path → source. Styling strings (`className`, `cn(...)`, class lists), a
 * repeat on another attribute of the same JSX element, and lines inside
 * `jscpd:ignore-start`/`-end` are skipped.
 */
export function findNewRepeatedCopy({
  current,
  base,
}: {
  current: Map<string, string>;
  base: Map<string, string>;
}): RepeatedCopy[] {
  const now = indexCopy(current);
  const before = indexCopy(base);

  return [...now]
    .filter(
      ([text, occurrences]) =>
        occurrences.length > 1 &&
        occurrences.length > (before.get(text)?.length ?? 0),
    )
    .map(([text, occurrences]) => ({ text, occurrences }));
}
