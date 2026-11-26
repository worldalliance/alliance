import type { ImagesItem } from "@alliance/common/forms/display-blocks";

export function newItemId(): string {
  return `img-${crypto.randomUUID()}`;
}

// Blocks migrated from the old `image` kind carry no item ids, so the first
// write from this editor backfills them. Until then `rowKeys` falls back to
// the src, which is enough while the list is untouched.
export function withItemIds(images: ImagesItem[]): ImagesItem[] {
  return images.map((image) =>
    image.id ? image : { ...image, id: newItemId() },
  );
}

// React needs keys that survive reordering, or an edit mid-drag remounts the
// row being dragged.
export function rowKeys(images: ImagesItem[]): string[] {
  const seen = new Map<string, number>();
  return images.map((image) => {
    if (image.id) return image.id;
    const occurrence = seen.get(image.src) ?? 0;
    seen.set(image.src, occurrence + 1);
    return `${image.src}#${occurrence}`;
  });
}
