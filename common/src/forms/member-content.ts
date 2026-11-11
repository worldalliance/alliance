import type { DisplayBlock } from "./display-blocks";
import { isQuestionField, type FormSchema } from "./form-schema";

function blockForMember(
  block: DisplayBlock,
  userId: number | null,
): DisplayBlock {
  if (block.manualUserContent === undefined) return block;
  const key = userId === null ? undefined : String(userId);
  const own = key === undefined ? undefined : block.manualUserContent[key];
  return {
    ...block,
    manualUserContent:
      key === undefined || own === undefined ? undefined : { [key]: own },
  };
}

/**
 * Keeps only `userId`'s entry of each per-member display block, none without a
 * member, so a schema sent to one member carries no other member's content.
 */
export function schemaWithMemberContent(
  schema: FormSchema,
  userId: number | null,
): FormSchema {
  return {
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: page.fields.map((item) =>
        isQuestionField(item) ? item : blockForMember(item, userId),
      ),
    })),
    outputViews: schema.outputViews.map((view) => ({
      ...view,
      blocks: view.blocks.map((block) =>
        "fieldId" in block ? block : blockForMember(block, userId),
      ),
    })),
  };
}
