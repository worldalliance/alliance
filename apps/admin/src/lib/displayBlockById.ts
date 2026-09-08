import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  flattenPageItems,
  mapPageItems,
  type FormSchema,
  type OutputBlock,
  type PageItem,
} from "@alliance/common/forms/form-schema";

type SchemaItem = PageItem | OutputBlock;

export type BlockUpdate = (current: DisplayBlock) => Partial<DisplayBlock>;

/**
 * The block the write handed the update, so a caller can read what the update
 * saw. Null once the form no longer holds the block.
 */
export type AddressedWrite = (update: BlockUpdate) => DisplayBlock | null;

export type BlockWriteById = (
  blockId: string,
  update: BlockUpdate,
) => DisplayBlock | null;

// An output field block carries an id but no `type` of its own.
const isDisplayBlock = (item: SchemaItem): item is DisplayBlock =>
  "type" in item && item.type === "display";

/**
 * The write to hand a block editor, addressed by the id `findDisplayBlock`
 * answers to. Undefined for an element the form cannot address that way, whose
 * editor keeps writing through `onUpdate`, since an addressed write that always
 * answers null would drop the edit.
 */
export function addressedWrite(
  item: SchemaItem,
  write: BlockWriteById,
): AddressedWrite | undefined {
  if (!isDisplayBlock(item) || !item.id) return undefined;
  const blockId = item.id;
  return (update) => write(blockId, update);
}

/**
 * Descends into field groups, whose children the builder edits as page items.
 * Null for a block nested in a container block, which is addressed through the
 * container that holds it rather than from here.
 */
export function findDisplayBlock(
  schema: FormSchema,
  blockId: string,
): DisplayBlock | null {
  const items: SchemaItem[] = [
    ...schema.pages.flatMap((page) => flattenPageItems(page.fields)),
    ...(schema.outputViews ?? []).flatMap((view) => view.blocks),
  ];
  for (const item of items) {
    if (isDisplayBlock(item) && item.id === blockId) return item;
  }
  return null;
}

/**
 * Swaps by identity rather than by id again, so a second block stored under
 * the same id keeps its own content.
 */
export function replaceDisplayBlock({
  schema,
  target,
  next,
}: {
  schema: FormSchema;
  target: DisplayBlock;
  next: DisplayBlock;
}): FormSchema {
  const swap = <T extends SchemaItem>(item: T): T | DisplayBlock =>
    item === target ? next : item;

  return {
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: mapPageItems(page.fields, swap),
    })),
    outputViews: (schema.outputViews ?? []).map((view) => ({
      ...view,
      blocks: view.blocks.map(swap),
    })),
  };
}
