import {
  isQuestionField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";

/** Returns `formData` itself when no list changes, so a state update bails out. */
export function prefillListsFromPreviousAnswers({
  schema,
  previousAnswerData,
  formData,
}: {
  schema: FormSchema;
  previousAnswerData: Record<number, Record<string, unknown>>;
  formData: Record<string, FormValue>;
}): Record<string, FormValue> {
  const next = { ...formData };
  let didUpdate = false;

  for (const page of schema.pages) {
    for (const element of page.fields) {
      if (!isQuestionField(element)) continue;
      if (element.kind !== "list") continue;
      const listField = element;
      const prefill = listField.prefillFromPreviousAnswer;
      if (!prefill) continue;

      // Only prefill if untouched (undefined, null, or array of all-empty objects from defaultNumber)
      const cur = next[listField.id];
      const isUntouched =
        cur === undefined ||
        cur === null ||
        (Array.isArray(cur) &&
          cur.every(
            (c: unknown) =>
              typeof c === "object" &&
              c !== null &&
              Object.keys(c).length === 0,
          ));
      if (!isUntouched) continue;

      const sourceAnswers = previousAnswerData[prefill.sourceFormId];
      if (!sourceAnswers) continue;
      const sourceList = sourceAnswers[prefill.sourceFieldId];
      if (!Array.isArray(sourceList) || sourceList.length === 0) continue;

      const maxCards =
        typeof listField.max === "number" ? listField.max : Infinity;
      const items = sourceList.slice(0, maxCards);

      const prefilledCards = items.map((srcCard: Record<string, unknown>) => {
        const card: Record<string, FormValue> = {};
        const val = srcCard[prefill.sourceSubFieldId];
        if (val !== undefined && val !== null) {
          card[prefill.targetSubFieldId] = val as FormValue;
        }
        return card;
      });

      next[listField.id] = prefilledCards;
      didUpdate = true;
    }
  }
  return didUpdate ? next : formData;
}
