import { FIELD_KIND_NAMES } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { getRangeValues } from "@alliance/common/forms/range";

export enum LiveChangeKind {
  /** A question id in the saved schema is gone. The server stores no rename, so an id change shows as this. */
  QuestionRemoved = "questionRemoved",
  /** Same id, different kind. */
  KindChanged = "kindChanged",
  /** A fixed option value gone, or a range value cut off by fewer options. */
  OptionRemoved = "optionRemoved",
}

export type LiveChange = {
  kind: LiveChangeKind;
  questionId: string;
  questionLabel: string;
  /** `KindChanged`: "from X to Y"; `OptionRemoved`: the option, `"Yes" (yes)`; otherwise null. */
  detail: string | null;
};

type Option = { label: string; value: string };

/** A question's fixed options, or null where it has none to compare, as with an options formula. */
function fixedOptions(field: AnyField): Option[] | null {
  switch (field.kind) {
    case "radio":
    case "ranking":
    case "conversation":
      return field.options;
    case "select":
    case "multiselect":
      return field.optionsFormula ? null : field.options;
    case "range":
      return getRangeValues(field).map((value) => ({
        label: String(value),
        value: String(value),
      }));
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "number":
    case "checkbox":
    case "date":
    case "time":
    case "timezone":
    case "city":
    case "file":
    case "contract":
    case "list":
    case "custom":
    case "image":
    case "toggle":
    case "timePicker":
      return null;
    default:
      throw new Error(`unknown kind: ${field satisfies never}`);
  }
}

/** Every question on the form, list sub-fields keyed under their list. */
function questionsById(schema: FormSchema): Map<string, AnyField> {
  const questions = new Map<string, AnyField>();
  for (const page of schema.pages) {
    for (const element of page.fields) {
      if (!isQuestionField(element)) continue;
      questions.set(element.id, element);
      if (element.kind === "list") {
        for (const sub of element.fields) {
          questions.set(`${element.id}/${sub.id}`, sub);
        }
      }
    }
  }
  return questions;
}

const labelOf = (field: AnyField) => field.label?.trim() || field.id;

/**
 * What a save of `draft` over `saved` removes or retypes among the answers
 * members give: questions by id, then fixed option values. Formula-sourced
 * options aren't compared.
 */
export function liveFormChanges(
  saved: FormSchema,
  draft: FormSchema,
): LiveChange[] {
  const after = questionsById(draft);
  const changes: LiveChange[] = [];
  for (const [key, before] of questionsById(saved)) {
    const change = { questionId: before.id, questionLabel: labelOf(before) };
    const now = after.get(key);
    if (!now) {
      changes.push({
        ...change,
        kind: LiveChangeKind.QuestionRemoved,
        detail: null,
      });
      continue;
    }
    if (now.kind !== before.kind) {
      changes.push({
        ...change,
        kind: LiveChangeKind.KindChanged,
        detail: `from ${FIELD_KIND_NAMES[before.kind]} to ${FIELD_KIND_NAMES[now.kind]}`,
      });
      continue;
    }
    const kept = new Set(fixedOptions(now)?.map(({ value }) => value));
    for (const option of fixedOptions(before) ?? []) {
      if (fixedOptions(now) === null || kept.has(option.value)) continue;
      changes.push({
        ...change,
        kind: LiveChangeKind.OptionRemoved,
        detail: `"${option.label.trim() || option.value}" (${option.value})`,
      });
    }
  }
  return changes;
}

const SHOWN_CHANGES = 10;

/** One line per change, as the save confirmation lists them. */
export function describeLiveChanges(changes: readonly LiveChange[]): string[] {
  const lines = changes.slice(0, SHOWN_CHANGES).map((change) => {
    const question = `"${change.questionLabel}"`;
    switch (change.kind) {
      case LiveChangeKind.QuestionRemoved:
        return `• Removes the question ${question} (${change.questionId})`;
      case LiveChangeKind.KindChanged:
        return `• Changes ${question} ${change.detail ?? ""}`;
      case LiveChangeKind.OptionRemoved:
        return `• Removes the option ${change.detail ?? ""} from ${question}`;
      default:
        throw new Error(`unknown change: ${change.kind satisfies never}`);
    }
  });
  const more = changes.length - SHOWN_CHANGES;
  return more > 0 ? [...lines, `…and ${more} more`] : lines;
}
