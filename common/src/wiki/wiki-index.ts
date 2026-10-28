import type { ListItem } from "mdast";
import { R, type Result } from "../result";
import { isTopicPath, WIKI_INDEX } from "./layout";
import {
  firstContentNode,
  nodePosition,
  renderedText,
  type SourcePosition,
  type WikiDocument,
  type WikiProblem,
} from "./markdown";
import { LinkKind, resolveLink } from "./resolve";

export interface WikiIndexEntry {
  path: string;
  title: string;
  description: string;
  position: SourcePosition;
}

export interface WikiIndexGroup {
  title: string;
  position: SourcePosition;
  entries: WikiIndexEntry[];
}

export interface WikiIndex {
  groups: WikiIndexGroup[];
  problems: WikiProblem[];
}

const DESCRIPTION_SEPARATOR = /^\s*(?:--|[-–—:])\s*/;

function parseEntry(item: ListItem): Result<WikiIndexEntry, string> {
  const paragraph = item.children[0];
  const link =
    paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
  if (paragraph?.type !== "paragraph" || link?.type !== "link") {
    return R.failure("index entry must start with a link to a topic page");
  }
  if (
    item.children.length > 1 ||
    typeof item.checked === "boolean" ||
    paragraph.position?.start.line !== paragraph.position?.end.line
  ) {
    return R.failure(
      "index entries are one line: a link and a short description",
    );
  }
  const resolved = resolveLink({ fromPath: WIKI_INDEX, url: link.url });
  if (
    !resolved.ok ||
    resolved.value.kind !== LinkKind.Local ||
    resolved.value.fragment !== undefined ||
    !isTopicPath(resolved.value.path)
  ) {
    return R.failure(`index entry "${link.url}" is not a topic page`);
  }
  const title = renderedText(link).trim();
  if (title === "") {
    return R.failure(`index entry "${link.url}" needs a title`);
  }
  const description = paragraph.children
    .slice(1)
    .map((node) => renderedText(node))
    .join("")
    .replace(DESCRIPTION_SEPARATOR, "")
    .trim();
  if (description === "") {
    return R.failure(`index entry "${link.url}" needs a short description`);
  }
  return R.success({
    path: resolved.value.path,
    title,
    description,
    position: nodePosition(item),
  });
}

/** Groups are the index's level-two headings, each followed by a list of topic entries. */
export function parseWikiIndex(document: WikiDocument): WikiIndex {
  const groups: WikiIndexGroup[] = [];
  const withMalformedEntries = new Set<WikiIndexGroup>();
  const problems: WikiProblem[] = [];
  const problem = (position: SourcePosition, message: string) =>
    problems.push({ path: WIKI_INDEX, position, message });

  for (const node of document.tree.children) {
    if (node.type === "heading" && node.depth === 2) {
      const title = renderedText(node).trim();
      if (title === "")
        problem(nodePosition(node), "index group needs a title");
      groups.push({ title, position: nodePosition(node), entries: [] });
    } else if (node.type === "heading" && node.depth > 2) {
      problem(nodePosition(node), "index groups are one level deep");
    } else if (
      node.type === "heading" &&
      node !== firstContentNode(document.tree)
    ) {
      problem(
        nodePosition(node),
        "only the index title is a level-one heading",
      );
    } else if (node.type === "list") {
      const group = groups.at(-1);
      if (group === undefined) {
        problem(nodePosition(node), "index entries belong under a group");
        continue;
      }
      for (const item of node.children) {
        const parsed = parseEntry(item);
        if (parsed.ok) {
          group.entries.push(parsed.value);
        } else {
          problem(nodePosition(item), parsed.error);
          withMalformedEntries.add(group);
        }
      }
    } else if (groups.length > 0 && node.type !== "heading") {
      problem(nodePosition(node), "index groups hold only a list of entries");
    }
  }
  for (const group of groups) {
    if (group.entries.length === 0 && !withMalformedEntries.has(group)) {
      problem(group.position, `index group "${group.title}" is empty`);
    }
  }
  problems.sort(
    (a, b) =>
      a.position.line - b.position.line ||
      a.position.column - b.position.column,
  );
  return { groups, problems };
}
