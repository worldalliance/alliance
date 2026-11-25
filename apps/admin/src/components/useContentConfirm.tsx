import { isAllianceAppHostname } from "@alliance/common/url";
import type { Nodes } from "mdast";
import { fromMarkdown, type Handle } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { useCallback, useRef, useState } from "react";
import { textContext } from "../lib/textContext";
import ConfirmDialog from "./ConfirmDialog";

const LEGACY_TEXT = /worldalliance/gi;

type Span = { text: string; start: number; end: number };

export const stringsIn = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
};

// The base gives `//host/path` its host and a bare path a host that is never
// the site's.
const isSiteLink = (href: string): boolean => {
  try {
    const url = new URL(href, "https://example.invalid");
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      isAllianceAppHostname(url.hostname)
    );
  } catch {
    return false;
  }
};

const nodesIn = (node: Nodes): Nodes[] => [
  node,
  ...("children" in node ? node.children.flatMap(nodesIn) : []),
];

type Link = { url: string; span: Span };

type Syntax = { bareUrls: boolean };

const linksIn = (text: string, { bareUrls }: Syntax): Link[] => {
  // The destination as written, so escapes, entities, angle brackets and a
  // title don't move it; an autolink has none and is its whole text.
  const destinations = new Map<unknown, Span>();
  const recordDestination: Handle = function (token) {
    destinations.set(this.stack.at(-1), {
      text,
      start: token.start.offset,
      end: token.end.offset,
    });
  };
  const nodes = nodesIn(
    fromMarkdown(text, {
      extensions: bareUrls ? [gfm()] : [],
      mdastExtensions: [
        ...(bareUrls ? [gfmFromMarkdown()] : []),
        {
          exit: {
            resourceDestination: recordDestination,
            definitionDestination: recordDestination,
          },
        },
      ],
    }),
  );
  const references = (type: "linkReference" | "imageReference") =>
    new Set(
      nodes.flatMap((node) => (node.type === type ? [node.identifier] : [])),
    );
  const linkReferences = references("linkReference");
  // A path in a definition an image also uses would break the image.
  const imageReferences = references("imageReference");
  const definitions = nodes.flatMap((node) =>
    node.type === "definition" ? [node] : [],
  );
  return nodes.flatMap((node) => {
    // CommonMark uses the first definition of a label.
    const linked =
      node.type === "link" ||
      (node.type === "definition" &&
        linkReferences.has(node.identifier) &&
        !imageReferences.has(node.identifier) &&
        definitions.find((d) => d.identifier === node.identifier) === node);
    if (!linked || !node.position) return [];
    return [
      {
        url: node.url,
        span: destinations.get(node) ?? {
          text,
          start: node.position.start.offset ?? 0,
          end: node.position.end.offset ?? text.length,
        },
      },
    ];
  });
};

const siteLinkSpans = (text: string, syntax: Syntax): Span[] =>
  linksIn(text, syntax).flatMap(({ url, span }) =>
    isSiteLink(url) ? [span] : [],
  );

/**
 * The destination of each markdown link in any string `value` holds, leaving
 * out a reference definition an image also uses.
 */
export const linkDestinations = (value: unknown, syntax: Syntax): string[] =>
  stringsIn(value).flatMap((text) =>
    linksIn(text, syntax).map(({ url }) => url),
  );

const excerpt = (span: Span): string => {
  const { before, flagged, after, cutBefore, cutAfter } = textContext(span);
  // The context window can cut an emoji's surrogate pair in half.
  return [
    cutBefore ? "…" : "",
    before.replace(/^[\uDC00-\uDFFF]/, ""),
    flagged,
    after.replace(/[\uD800-\uDBFF]$/, ""),
    cutAfter ? "…" : "",
  ]
    .join("")
    .replace(/\s+/g, " ");
};

const unique = (spans: Span[]): string[] => [...new Set(spans.map(excerpt))];

type ContentFindings = { siteLinks: string[]; worldalliance: string[] };

const wholeSiteLink = (text: string): Span[] =>
  isSiteLink(text) ? [{ text, start: 0, end: text.length }] : [];

type LinkInputs = {
  siteLinksIn?: unknown;
  siteLinksInCommonMark?: unknown;
  siteUrlsIn?: unknown;
};

/**
 * The text around the url of each markdown link to the site in any string
 * `siteLinksIn` holds, bare urls GitHub-flavoured markdown links included, and
 * in `siteLinksInCommonMark`, whose renderers leave a bare url as text; each
 * string `siteUrlsIn` holds that is itself a url to the site; and the text
 * around each mention of worldalliance outside those urls in any string
 * `value` holds, at any depth.
 */
export function contentFindings({
  value,
  siteLinksIn,
  siteLinksInCommonMark,
  siteUrlsIn,
}: LinkInputs & { value: unknown }): ContentFindings {
  const linkSpans = new Map<string, Span[]>();
  const add = (text: string, spans: Span[]) =>
    linkSpans.set(text, [...(linkSpans.get(text) ?? []), ...spans]);
  for (const text of stringsIn(siteLinksIn)) {
    add(text, siteLinkSpans(text, { bareUrls: true }));
  }
  for (const text of stringsIn(siteLinksInCommonMark)) {
    add(text, siteLinkSpans(text, { bareUrls: false }));
  }
  for (const text of stringsIn(siteUrlsIn)) add(text, wholeSiteLink(text));
  const siteLinks = [...linkSpans.values()].flat();
  const worldalliance = stringsIn(value).flatMap((text) => {
    const links = linkSpans.get(text) ?? [];
    return [...text.matchAll(LEGACY_TEXT)].flatMap((match): Span[] =>
      links.some((link) => link.start <= match.index && match.index < link.end)
        ? []
        : [{ text, start: match.index, end: match.index + match[0].length }],
    );
  });
  return { siteLinks: unique(siteLinks), worldalliance: unique(worldalliance) };
}

const section = (heading: string, excerpts: string[]): string[] =>
  excerpts.length === 0
    ? []
    : ["", heading, ...excerpts.map((text) => `• ${text}`)];

/**
 * `confirmSave(value, links)` resolves true at once when `contentFindings`
 * finds nothing in `value` and `links`, and otherwise opens `dialog` and
 * resolves with the admin's choice. A call with findings while the dialog is
 * open replaces it, resolving the earlier call false.
 */
export function useContentConfirm() {
  const [findings, setFindings] = useState<ContentFindings | null>(null);
  const resolveOpen = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmSave = useCallback(
    (value: unknown, links: LinkInputs = {}): Promise<boolean> => {
      const found = contentFindings({ value, ...links });
      if (found.siteLinks.length === 0 && found.worldalliance.length === 0) {
        return Promise.resolve(true);
      }
      resolveOpen.current?.(false);
      setFindings(found);
      return new Promise((resolve) => {
        resolveOpen.current = resolve;
      });
    },
    [],
  );

  const settle = (confirmed: boolean) => {
    resolveOpen.current?.(confirmed);
    resolveOpen.current = null;
    setFindings(null);
  };

  const dialog = (
    <ConfirmDialog
      isOpen={findings !== null}
      title="Save anyway?"
      message={[
        ...section(
          "Links to the site should be paths, such as /actions/53, so they keep working if the domain changes:",
          findings?.siteLinks ?? [],
        ),
        ...section(
          "This mentions worldalliance. Links should use thealliance.org; names that still use worldalliance, such as the GitHub organization, can stay:",
          findings?.worldalliance ?? [],
        ),
      ]
        .slice(1)
        .join("\n")}
      confirmLabel="Save anyway"
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirmSave, dialog };
}
