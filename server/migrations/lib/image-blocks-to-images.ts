// Frozen helpers for `1787679092673-ImageBlocksToImages`. They live outside
// `migrations/*.ts` because TypeORM instantiates every export it finds there.
// Application code must not import them, and their behavior must not change
// once the migration has run.
//
// `expandable` is dropped: every image opens a lightbox now. `aspectRatio` is
// dropped with it: no editor ever wrote one and no row carries one, and a
// single ratio can't describe a set of images. Empty `alt` and `caption` go
// too, since both are optional on the new item.
//
// General and action updates store display-only schemas directly in
// form_snapshot, so their top-level `blocks` need conversion too.
//
// `down` restores neither `expandable` nor `aspectRatio`; the new shape has
// nowhere to keep them. It also keeps only the first image of a carousel,
// since an `image` block holds exactly one.

type Json = Record<string, unknown>;

export type ConversionDirection = "up" | "down";

function isObject(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function convertContent(node: Json): void {
  const src = typeof node.src === "string" ? node.src : "";
  const alt = optionalString(node.alt);
  const caption = optionalString(node.caption);
  delete node.src;
  delete node.alt;
  delete node.caption;
  delete node.expandable;
  delete node.aspectRatio;
  node.images = [
    {
      src,
      ...(alt !== undefined && { alt }),
      ...(caption !== undefined && { caption }),
    },
  ];
}

function revertContent(node: Json): void {
  const images = Array.isArray(node.images) ? node.images : [];
  const first = isObject(images[0]) ? images[0] : {};
  delete node.images;
  node.src = typeof first.src === "string" ? first.src : "";
  node.alt = typeof first.alt === "string" ? first.alt : "";
  const caption = optionalString(first.caption);
  if (caption !== undefined) node.caption = caption;
}

function convertBlock(node: unknown, direction: ConversionDirection): void {
  if (!isObject(node)) return;
  if (node.kind !== (direction === "up" ? "image" : "images")) return;
  const rewrite = direction === "up" ? convertContent : revertContent;

  // Per-user overrides are spread over the block at render time, so they carry
  // the same content shape without a `kind` of their own.
  const manual = node.manualUserContent;
  if (isObject(manual)) {
    for (const content of Object.values(manual)) {
      if (isObject(content)) rewrite(content);
    }
  }

  rewrite(node);
  node.kind = direction === "up" ? "images" : "image";
}

export function convertImageBlocks(
  schema: unknown,
  direction: ConversionDirection,
): void {
  if (!isObject(schema)) return;

  if (Array.isArray(schema.blocks)) {
    for (const block of schema.blocks) convertBlock(block, direction);
  }

  if (Array.isArray(schema.pages)) {
    for (const page of schema.pages) {
      if (!isObject(page) || !Array.isArray(page.fields)) continue;
      for (const element of page.fields) convertBlock(element, direction);
    }
  }

  if (Array.isArray(schema.outputViews)) {
    for (const view of schema.outputViews) {
      if (!isObject(view) || !Array.isArray(view.blocks)) continue;
      for (const block of view.blocks) convertBlock(block, direction);
    }
  }
}
