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
export function formTexts(schema: FormSchema): string[] {
  const texts: (string | null | undefined)[] = [schema.description];
  for (const page of schema.pages) {
    texts.push(page.title, page.description);

    for (const field of page.fields) {
      if (isQuestionField(field)) texts.push(field.label);
      if ("description" in field) texts.push(field.description as string);
      if (isQuestionField(field) && fieldHasOptions(field)) {
        for (const option of field.options) {
          texts.push(option.label);
        }
      }
      if ("text" in field) texts.push(field.text as string);
      if ("caption" in field) texts.push(field.caption as string);
      if ("startLabel" in field) texts.push(field.startLabel as string);
      if ("endLabel" in field) texts.push(field.endLabel as string);
    }
  }
  return texts.filter((text): text is string => !!text);
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

  let descriptionWords = 0;
  descriptionWords += countWords(action.body);
  descriptionWords += countWords(action.shortDescription);

  const formWords = taskFormSchema
    ? formTexts(taskFormSchema).reduce(
        (total, text) => total + countWords(text),
        0,
      )
    : 0;

  const totalWords = descriptionWords + formWords;
  const totalSeconds = Math.round(totalWords * 0.462);
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
