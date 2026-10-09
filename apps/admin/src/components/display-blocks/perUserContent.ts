import type {
  DisplayBlock,
  ManualDisplayBlockContent,
  ManualImportClipboardPayload,
  ManualImportField,
} from "@alliance/common/forms/display-blocks";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import type { AddressedWrite } from "../../lib/displayBlockById";

const stripManualFields = (
  updates: Partial<DisplayBlock>,
): Partial<DisplayBlock> => {
  const {
    manualPerUser: _manualPerUser,
    manualUserContent: _manualUserContent,
    ...rest
  } = updates as Partial<DisplayBlock>;
  return rest;
};

const stripIdentityFields = <T extends Record<string, unknown>>(
  value: T,
): Omit<T, "kind" | "id" | "type"> => {
  const { kind: _kind, id: _id, type: _type, ...rest } = value;
  return rest;
};

const baseManualContentFromBlock = (
  block: DisplayBlock,
): ManualDisplayBlockContent =>
  stripIdentityFields(
    stripManualFields({
      ...block,
      manualPerUser: undefined,
      manualUserContent: undefined,
    }) as Record<string, unknown>,
  ) as ManualDisplayBlockContent;

/**
 * Where a write landed. `userId` is null for the default content, which is
 * where a write meant for one user goes once the block stops holding per-user
 * content. Null once the form no longer holds the block at all.
 */
export type BlockWriteLanding = { userId: string | null } | null;

export type LandingFor = (userId: string | null) => BlockWriteLanding;

export const landingIn = (
  current: DisplayBlock | null | undefined,
  userId: string | null,
): BlockWriteLanding =>
  current ? { userId: current.manualPerUser && userId ? userId : null } : null;

const updatesFor = <T extends DisplayBlock>({
  current,
  userId,
  update,
}: {
  current: T;
  userId: string | null;
  update: (current: T) => Partial<T>;
}): Partial<T> => {
  if (!current.manualPerUser || !userId) return update(current);

  const existingManualContent = current.manualUserContent ?? {};
  const existingContent =
    existingManualContent[userId] ?? baseManualContentFromBlock(current);

  const nextManualContent: Record<string, ManualDisplayBlockContent> = {
    ...existingManualContent,
    [userId]: stripIdentityFields({
      ...existingContent,
      ...(stripManualFields(
        update(resolveDisplayBlockForUser(current, userId)),
      ) as Record<string, unknown>),
    }) as ManualDisplayBlockContent,
  };

  return { manualUserContent: nextManualContent } as Partial<T>;
};

/**
 * Writes `update` to `userId`'s content, or to the default content for null
 * or a block without per-user content, through `updateCurrent` where the form
 * can address the block, else `onUpdate`. `update` gets that target's block
 * as the write finds it.
 */
export function writeBlockFor<T extends DisplayBlock>({
  block,
  userId,
  update,
  updateCurrent,
  onUpdate,
}: {
  block: T;
  userId: string | null;
  update: (current: T) => Partial<T>;
  updateCurrent: AddressedWrite | undefined;
  onUpdate: ((updates: Partial<T>) => void) | undefined;
}): BlockWriteLanding {
  // `updateCurrent` addresses this same block by its id, so what it hands
  // back is the T the caller rendered.
  if (updateCurrent) {
    const wrote = updateCurrent((current) =>
      updatesFor({ current: current as T, userId, update }),
    );
    return landingIn(wrote, userId);
  }
  if (!onUpdate) return null;
  onUpdate(updatesFor({ current: block, userId, update }));
  return landingIn(block, userId);
}

/**
 * `block`'s per-user content with each entry's text set as that user's
 * `field`, counting the users it changes and those whose differing text it
 * replaces.
 */
export function importManualContent({
  block,
  field,
  entries,
}: {
  block: DisplayBlock;
  field: ManualImportField;
  entries: ManualImportClipboardPayload;
}): {
  manualUserContent: Record<string, ManualDisplayBlockContent>;
  imported: number;
  overwritten: number;
} {
  const baseContent = baseManualContentFromBlock(block);
  const manualUserContent: Record<string, ManualDisplayBlockContent> = {
    ...block.manualUserContent,
  };
  let imported = 0;
  let overwritten = 0;
  for (const [userId, value] of Object.entries(entries)) {
    const existingContent = manualUserContent[userId] ?? baseContent;
    const existingValue = (
      existingContent as Record<string, unknown> | undefined
    )?.[field];
    if (manualUserContent[userId] && existingValue === value) {
      continue;
    }
    if (
      manualUserContent[userId] &&
      typeof existingValue === "string" &&
      existingValue.length > 0 &&
      existingValue !== value
    ) {
      overwritten++;
    }
    manualUserContent[userId] = stripIdentityFields({
      ...existingContent,
      [field]: value,
    }) as ManualDisplayBlockContent;
    imported++;
  }
  return { manualUserContent, imported, overwritten };
}
