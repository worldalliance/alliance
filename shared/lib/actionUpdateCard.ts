import {
  readDisplayOnlySchema,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { echoesStoredKey } from "@alliance/common/image-src";
import { uniqBy } from "es-toolkit";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { useMemo, useState } from "react";
import type { ActionUpdateDto } from "../client";

export type UpdateCover = { src: string; alt: string };

/** The update's card image, then the images in its body; else its project's cover image. */
export function updateCovers(params: {
  cardImage: string | null;
  schema: DisplayOnlySchema | null;
  actionImage: string | null | undefined;
}): UpdateCover[] {
  const { cardImage } = params;
  const bodyImages = (params.schema?.blocks ?? [])
    .flatMap((block) => (block.kind === "images" ? block.images : []))
    .filter(
      (image) =>
        !cardImage || !echoesStoredKey({ next: cardImage, stored: image.src }),
    )
    .map((image) => ({ src: image.src, alt: image.alt ?? "" }));
  const covers = uniqBy(
    [...(cardImage ? [{ src: cardImage, alt: "" }] : []), ...bodyImages],
    (cover) => cover.src,
  );
  if (covers.length > 0) return covers;
  return params.actionImage ? [{ src: params.actionImage, alt: "" }] : [];
}

const MOSAIC_TILES = 3;

/** The photos a card's mosaic shows, and how many more the last tile counts. */
export function updateMosaic(covers: UpdateCover[]): {
  tiles: UpdateCover[];
  hiddenCount: number;
} {
  return {
    tiles: covers.slice(0, MOSAIC_TILES),
    hiddenCount: Math.max(0, covers.length - MOSAIC_TILES),
  };
}

/** "N members participated", or null when no count is known or nobody has. */
export function participatedLabel(count: number | undefined): string | null {
  if (!count) return null;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "member" : "members"} participated`;
}

const LEAF_BLOCKS = new Set(["paragraph", "heading", "code", "tableCell"]);

type MarkdownNode = { type: string; children?: MarkdownNode[] };

function plainText(node: MarkdownNode): string[] {
  if (LEAF_BLOCKS.has(node.type)) return [toString(node)];
  return node.children?.flatMap(plainText) ?? [];
}

/** The update's first text block as plain text, for a short preview. */
export function updateExcerpt(schema: DisplayOnlySchema | null): string | null {
  for (const block of schema?.blocks ?? []) {
    if (block.kind === "text") {
      const text = plainText(fromMarkdown(block.text))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * What an update's card shows besides its title: mosaic photos, excerpt and
 * participation label. A photo reported through `markFailed` drops out of the
 * mosaic.
 */
export function useUpdateCardContent(
  update: Pick<
    ActionUpdateDto,
    "cardImage" | "schema" | "actionImage" | "actionUsersCompleted"
  >,
) {
  const { covers, excerpt } = useMemo(() => {
    const schema = readDisplayOnlySchema(update.schema);
    return {
      covers: updateCovers({
        cardImage: update.cardImage,
        schema,
        actionImage: update.actionImage,
      }),
      excerpt: updateExcerpt(schema),
    };
  }, [update.cardImage, update.schema, update.actionImage]);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  return {
    ...updateMosaic(covers.filter((cover) => !failed.has(cover.src))),
    excerpt,
    participated: participatedLabel(update.actionUsersCompleted),
    markFailed: (src: string) => setFailed((prev) => new Set(prev).add(src)),
  };
}
