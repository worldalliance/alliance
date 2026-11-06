import {
  PlaceKind,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import {
  fieldHasOptions,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { secondsInMinute } from "date-fns/constants";
import { isEqual } from "es-toolkit";
import { placeForSelect } from "../../lib/formDependencies";
import { STAFF_TESTING_REQUIREMENTS } from "../../lib/staffTestingGate";

export type ReadinessCheckItem = {
  id: string;
  label: string;
  isReady: boolean;
  required?: boolean;
};

const countWords = (text: string | null | undefined): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Each piece of a form's text with the id `formEditorPath` selects its page or
 * element by, or null where none does: an element no id reaches gives its
 * page's.
 */
export function formTextPlaces(
  schema: FormSchema,
): { text: string; id: string | null }[] {
  const reaching = (id: string | undefined, place: FormPlace) =>
    id !== undefined && isEqual(placeForSelect(schema.pages, id), place)
      ? id
      : null;

  const texts: { text: string | null | undefined; id: string | null }[] = [
    { text: schema.description, id: null },
  ];
  for (const [pageIndex, page] of schema.pages.entries()) {
    const pageId = reaching(page.id, { kind: PlaceKind.Page, pageIndex });
    texts.push(
      { text: page.title, id: pageId },
      { text: page.description, id: pageId },
    );

    for (const [index, field] of page.fields.entries()) {
      const id =
        reaching(field.id, { kind: PlaceKind.Element, pageIndex, index }) ??
        pageId;
      const at = (text: unknown) => {
        if (typeof text === "string") texts.push({ text, id });
      };
      if (isQuestionField(field)) at(field.label);
      if ("description" in field) at(field.description);
      if (isQuestionField(field) && fieldHasOptions(field)) {
        for (const option of field.options) at(option.label);
      }
      if ("text" in field) at(field.text);
      if ("caption" in field) at(field.caption);
      if ("startLabel" in field) at(field.startLabel);
      if ("endLabel" in field) at(field.endLabel);
    }
  }
  return texts.flatMap(({ text, id }) => (text ? [{ text, id }] : []));
}

/** Every piece of member-facing text in a form schema, in page order. */
export function formTexts(schema: FormSchema): string[] {
  return formTextPlaces(schema).map(({ text }) => text);
}

/** How long the action's description and task form take to read. */
export function readingTime(
  action: Pick<ParsedActionDto, "body" | "shortDescription">,
  taskFormSchema: FormSchema | null,
): { descriptionWords: number; formWords: number; totalSeconds: number } {
  const descriptionWords =
    countWords(action.body) + countWords(action.shortDescription);
  const formWords = taskFormSchema
    ? formTexts(taskFormSchema).reduce(
        (total, text) => total + countWords(text),
        0,
      )
    : 0;
  return {
    descriptionWords,
    formWords,
    totalSeconds: Math.round((descriptionWords + formWords) * 0.462),
  };
}

export function actionReadinessItems(
  action: ParsedActionDto,
  taskFormSchema: FormSchema | null,
): ReadinessCheckItem[] {
  const partOfSuite = Boolean(action.suite?.id);
  const staffTestingItem = (id: string): ReadinessCheckItem => {
    const requirement = STAFF_TESTING_REQUIREMENTS.find((r) => r.id === id);
    if (!requirement) {
      throw new Error(`unknown staff testing requirement: ${id}`);
    }
    return {
      id,
      label: requirement.label,
      isReady: requirement.isReady(action),
      required: true,
    };
  };
  const items: ReadinessCheckItem[] = [
    staffTestingItem("shortDescription"),
    staffTestingItem("body"),
    {
      id: "timeEstimate",
      label: "Time estimate set",
      isReady: (action.timeEstimate ?? 0) > 0,
    },
    {
      id: "suite",
      label: "Part of a suite",
      isReady: partOfSuite,
    },
    {
      id: "project",
      label: "Part of a project",
      isReady: Boolean(action.project),
    },
    staffTestingItem("cohort"),
    {
      id: "authors",
      label: "Action authors set",
      isReady: (action.authors?.length ?? 0) > 0,
    },
    staffTestingItem("taskForm"),
    {
      id: "image",
      label: "Image set",
      isReady: Boolean(action.image),
    },
    {
      id: "outputView",
      label: "Task form has an output view, for the completion card",
      isReady: (taskFormSchema?.outputViews.length ?? 0) > 0,
    },
  ];

  const { descriptionWords, formWords, totalSeconds } = readingTime(
    action,
    taskFormSchema,
  );
  const minutes = Math.floor(totalSeconds / secondsInMinute);
  const seconds = totalSeconds % secondsInMinute;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const readingTimeLabel = `Total reading time: ${timeStr}  - (${descriptionWords} description words + ${formWords} form words)`;

  items.push({
    id: "readingTime",
    label: readingTimeLabel,
    isReady: totalSeconds < 15 * secondsInMinute,
  });

  return items;
}
