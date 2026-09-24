import { z } from "zod";
import { R, type Result } from "../result";
import { anyFieldSchema, type AnyField } from "./form-schema";

/**
 * A stored snapshot read element by element. `formSchema` is strict and its
 * pages hold a discriminated union, so a single element written before its
 * kind was renamed fails the whole parse. That is the right answer when
 * validating a write and the wrong one when listing the questions another
 * form can point at or reading a response to an older version of a form.
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
  return R.success(questionFieldsOf(parsed.data.pages));
}

type StoredPages = z.infer<typeof storedSchema>["pages"];

function questionFieldsOf(pages: StoredPages): AnyField[] {
  return pages.flatMap((page) =>
    (page.fields ?? []).flatMap(storedQuestionFieldsFromElement),
  );
}

function storedQuestionFieldsFromElement(element: unknown): AnyField[] {
  const field = anyFieldSchema.safeParse(element);
  if (field.success) return [field.data];
  const group = storedElement.safeParse(element);
  if (!group.success || group.data.kind !== "group") return [];
  return (group.data.fields ?? []).flatMap(storedQuestionFieldsFromElement);
}

/**
 * The questions a submission's form version holds, for reading its answers.
 * A question there that no longer parses takes its definition from `current`,
 * so its answer is still read. If the question's kind, or a list sub-field's,
 * has changed since, the whole read fails, because the current definition
 * could misread the answer.
 */
export function submittedQuestionFields(params: {
  snapshot: unknown;
  current: readonly AnyField[];
}): Result<AnyField[], Error> {
  const parsed = storedSchema.safeParse(params.snapshot);
  if (!parsed.success) return R.failure(parsed.error);
  const fields = questionFieldsOf(parsed.data.pages);
  const read = new Set(fields.map((field) => field.id));
  const elements = storedElementsById(parsed.data.pages);
  const substitutes: AnyField[] = [];
  for (const field of params.current) {
    const stored = elements.get(field.id);
    if (read.has(field.id) || stored === undefined) continue;
    const change = kindChange(field, stored);
    if (change !== undefined) {
      return R.failure(
        new Error(
          `Question "${field.id}" can't be read in an earlier version of the form, where ${change}`,
        ),
      );
    }
    substitutes.push(field);
  }
  return R.success([...fields, ...substitutes]);
}

const storedElement = z.looseObject({
  id: z.string(),
  kind: z.unknown(),
  fields: z.array(z.unknown()).optional(),
});

type StoredElement = z.infer<typeof storedElement>;

function storedElementsOf(elements: readonly unknown[]): StoredElement[] {
  return elements.flatMap((element) => {
    const parsed = storedElement.safeParse(element);
    return parsed.success ? [parsed.data] : [];
  });
}

function storedElementsById(pages: StoredPages): Map<string, StoredElement> {
  const byId = new Map<string, StoredElement>();
  const visit = (elements: readonly unknown[]) => {
    for (const element of storedElementsOf(elements)) {
      byId.set(element.id, element);
      if (element.kind === "group") visit(element.fields ?? []);
    }
  };
  pages.forEach((page) => visit(page.fields ?? []));
  return byId;
}

function kindChange(
  field: AnyField,
  stored: StoredElement,
): string | undefined {
  if (stored.kind !== field.kind) return `its kind was ${String(stored.kind)}`;
  if (field.kind !== "list") return undefined;
  const storedKinds = new Map(
    storedElementsOf(stored.fields ?? []).map((sub) => [sub.id, sub.kind]),
  );
  const changed = field.fields.find(
    (sub) => storedKinds.has(sub.id) && storedKinds.get(sub.id) !== sub.kind,
  );
  return (
    changed &&
    `its sub-field "${changed.id}" was ${String(storedKinds.get(changed.id))}`
  );
}
