import GithubSlugger from "github-slugger";
import type { Nodes, Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString } from "mdast-util-to-string";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";

export interface SourcePosition {
  line: number;
  column: number;
}

export interface WikiProblem {
  path: string;
  position: SourcePosition;
  message: string;
}

export interface WikiHeading {
  depth: number;
  text: string;
  /** GitHub's anchor for the heading. */
  id: string;
  position: SourcePosition;
}

export interface WikiLink {
  url: string;
  position: SourcePosition;
}

export interface WikiDocument {
  tree: Root;
  title: string | undefined;
  headings: WikiHeading[];
  links: WikiLink[];
  htmlLinks: SourcePosition[];
}

const HTML_LINK = /(?<![\w-])(?:href|src|srcset)\s*=/i;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

function parseMarkdown(markdown: string): Root {
  return fromMarkdown(markdown, {
    extensions: [gfm(), frontmatter()],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
  });
}

/** The heading or link text as GitHub renders it, without tags or image alt text; GitHub anchors headings on it. */
export function renderedText(node: Nodes): string {
  return toString(node, { includeHtml: false, includeImageAlt: false });
}

export function nodePosition(node: Nodes): SourcePosition {
  return {
    line: node.position?.start.line ?? 1,
    column: node.position?.start.column ?? 1,
  };
}

export function linksIn(node: Nodes): WikiLink[] {
  const links: WikiLink[] = [];
  const visit = (current: Nodes) => {
    if (
      current.type === "link" ||
      current.type === "image" ||
      current.type === "definition"
    ) {
      links.push({ url: current.url, position: nodePosition(current) });
    }
    if ("children" in current) current.children.forEach(visit);
  };
  visit(node);
  return links;
}

/** The node a title must be: the first one after any front matter. */
export function firstContentNode(tree: Root): RootContent | undefined {
  return tree.children.find((node) => node.type !== "yaml");
}

export function parseWikiDocument(markdown: string): WikiDocument {
  const tree = parseMarkdown(markdown);
  const slugger = new GithubSlugger();
  const headings: WikiHeading[] = [];
  const htmlLinks: SourcePosition[] = [];
  const visit = (node: Nodes) => {
    if (
      node.type === "html" &&
      HTML_LINK.test(node.value.replace(HTML_COMMENT, ""))
    ) {
      htmlLinks.push(nodePosition(node));
    }
    if (node.type === "heading") {
      const text = renderedText(node);
      headings.push({
        depth: node.depth,
        text,
        id: slugger.slug(text),
        position: nodePosition(node),
      });
    }
    if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
  const first = firstContentNode(tree);
  return {
    tree,
    title:
      first?.type === "heading" && first.depth === 1
        ? renderedText(first).trim() || undefined
        : undefined,
    headings,
    links: linksIn(tree),
    htmlLinks,
  };
}
