import {
  fieldHasOptions,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { secondsInMinute } from "date-fns/constants";

export type ReadinessCheckItem = {
  id: string;
  label: string;
  isReady: boolean;
};

const countWords = (text: string | null | undefined): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/** Every piece of member-facing text in a form schema, in page order. */
/** Each piece of a form's text with the page or element it belongs to, null for the form's own description. */
export function formTextPlaces(
  schema: FormSchema,
): { text: string; id: string | null }[] {
  const texts: { text: string | null | undefined; id: string | null }[] = [
    { text: schema.description, id: null },
  ];
  for (const page of schema.pages) {
    texts.push(
      { text: page.title, id: page.id },
      { text: page.description, id: page.id },
    );

    for (const field of page.fields) {
      const at = (text: unknown) => {
        if (typeof text === "string") texts.push({ text, id: field.id ?? null });
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
  const trimmedShortDescription = action.shortDescription?.trim() ?? "";
  const trimmedBody = action.body?.trim() ?? "";
  const partOfSuite = Boolean(action.suite?.id);
  const items: ReadinessCheckItem[] = [
    {
      id: "shortDescription",
      label: "Short description",
      isReady: trimmedShortDescription.length > 0,
    },
    {
      id: "body",
      label: "Full body content",
      isReady: trimmedBody.length > 0,
    },
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
    {
      id: "cohort",
      label: "Cohort expression set",
      isReady: !!action.cohortExpression,
    },
    {
      id: "authors",
      label: "Action authors set",
      isReady: (action.authors?.length ?? 0) > 0,
    },
    {
      id: "taskForm",
      label: "Task form linked",
      isReady: Boolean(action.taskFormId),
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
