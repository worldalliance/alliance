import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  OutputBlock,
} from "@alliance/common/forms/form-schema";

type SchemaItem = AnyField | DisplayBlock | OutputBlock;

export type BlockUpdate = (current: DisplayBlock) => Partial<DisplayBlock>;

export type AddressedWrite = (update: BlockUpdate) => boolean;

export type BlockWriteById = (blockId: string, update: BlockUpdate) => boolean;

// An output field block carries an id but no `type` of its own.
const isDisplayBlock = (item: SchemaItem): item is DisplayBlock =>
  "type" in item && item.type === "display";

/**
 * The write to hand a block editor, addressed by the id `findDisplayBlock`
 * answers to. Undefined for an element the form cannot address that way, whose
 * editor keeps writing through `onUpdate`, since an addressed write that always
 * answers false would drop the edit.
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
 * Null for a block nested in a container, which is addressed through the
 * container that holds it rather than from here.
 */
export function findDisplayBlock(
  schema: FormSchema,
  blockId: string,
): DisplayBlock | null {
  const items: SchemaItem[] = [
    ...schema.pages.flatMap((page) => page.fields),
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
      fields: page.fields.map(swap),
    })),
    outputViews: (schema.outputViews ?? []).map((view) => ({
      ...view,
      blocks: view.blocks.map(swap),
    })),
  };
}
