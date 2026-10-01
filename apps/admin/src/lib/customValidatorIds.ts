import {
  flattenPageItems,
  forEachCondition,
  forEachOutputViewCondition,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { Condition } from "@alliance/common/forms/visible-if-formula";

/** Rewrites every reference to a custom validator: field validators and
 * validator conditions, on pages and output views alike. */
export function mapCustomValidatorIds(
  schema: FormSchema,
  map: (id: number) => number,
): FormSchema {
  const next = structuredClone(schema);
  const visit = (condition: Condition) => {
    if (condition.kind === "validator") {
      condition.validatorId = map(condition.validatorId);
    }
  };
  forEachCondition(next, visit);
  forEachOutputViewCondition(next, visit);
  for (const page of next.pages) {
    for (const element of flattenPageItems(page.fields)) {
      if (!isQuestionField(element)) continue;
      const subFields = element.kind === "list" ? element.fields : [];
      for (const field of [element, ...subFields]) {
        if (field.customValidatorId !== undefined) {
          field.customValidatorId = map(field.customValidatorId);
        }
      }
    }
  }
  return next;
}

export function customValidatorIds(schema: FormSchema): Set<number> {
  const ids = new Set<number>();
  mapCustomValidatorIds(schema, (id) => {
    ids.add(id);
    return id;
  });
  return ids;
}
