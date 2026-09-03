import { z } from "zod";
import { R, type Result } from "../result";
import { anyFieldSchema, fieldGroupSchema, type AnyField } from "./form-schema";

/**
 * A stored snapshot read element by element. `formSchema` is strict and its
 * pages hold a discriminated union, so a single element written before its
 * kind was renamed fails the whole parse. That is the right answer when
 * validating a write and the wrong one when listing the questions another
 * form can point at, which is what this module is for.
 */
const storedSchema = z.looseObject({
  pages: z.array(z.looseObject({ fields: z.array(z.unknown()).optional() })),
});

/**
 * Every element that still parses as a question field. An element that no
 * longer does is skipped, so one stale block costs one field rather than
 * emptying the picker for the whole form.
 */
export function storedQuestionFields(
  schema: unknown,
): Result<AnyField[], z.ZodError> {
  const parsed = storedSchema.safeParse(schema);
  if (!parsed.success) return R.failure(parsed.error);
  return R.success(
    parsed.data.pages.flatMap((page) =>
      (page.fields ?? []).flatMap(storedQuestionFieldsFromElement),
    ),
  );
}

function storedQuestionFieldsFromElement(element: unknown): AnyField[] {
  const field = anyFieldSchema.safeParse(element);
  if (field.success) return [field.data];
  const group = fieldGroupSchema.safeParse(element);
  if (!group.success) return [];
  return group.data.fields.flatMap(storedQuestionFieldsFromElement);
}
