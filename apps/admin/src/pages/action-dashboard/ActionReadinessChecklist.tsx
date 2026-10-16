import {
  fieldHasOptions,
  isQuestionField,
} from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import { secondsInMinute } from "date-fns/constants";
import {
  AlertTriangle,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from "lucide-react";
import React, { useMemo } from "react";
import type { FormWithSchema } from "../../components/FormResponsesView";

type ReadinessCheckItem = {
  id: string;
  label: string;
  isReady: boolean;
};

const countWords = (text: string | null | undefined): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

type ActionReadinessChecklistProps = {
  action: ParsedActionDto | null;
  taskForm: FormWithSchema | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

const ActionReadinessChecklist: React.FC<ActionReadinessChecklistProps> = ({
  action,
  taskForm,
  collapsed: checklistCollapsed,
  onCollapsedChange: setChecklistCollapsed,
}) => {
  const readinessChecklist = useMemo<ReadinessCheckItem[]>(() => {
    if (!action) {
      return [];
    }

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

    let formWords = 0;
    if (taskForm?.schema) {
      const schema = taskForm.schema;
      formWords += countWords(schema.description);

      for (const page of schema.pages) {
        formWords += countWords(page.title);
        formWords += countWords(page.description);

        for (const field of page.fields) {
          if (isQuestionField(field)) formWords += countWords(field.label);
          if ("description" in field)
            formWords += countWords(field.description as string);
          if (isQuestionField(field) && fieldHasOptions(field)) {
            for (const option of field.options) {
              formWords += countWords(option.label);
            }
          }
          if ("text" in field) formWords += countWords(field.text as string);
          if ("caption" in field)
            formWords += countWords(field.caption as string);
          if ("startLabel" in field)
            formWords += countWords(field.startLabel as string);
          if ("endLabel" in field)
            formWords += countWords(field.endLabel as string);
        }
      }
    }

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
  }, [action, taskForm]);

  const readinessReadyCount = readinessChecklist.filter(
    (item) => item.isReady,
  ).length;
  const readinessTotalCount = readinessChecklist.length;
  const readinessComplete =
    readinessTotalCount > 0 && readinessReadyCount === readinessTotalCount;

  if (readinessTotalCount === 0) return null;

  return (
    <Card style={CardStyle.White}>
      <button
        type="button"
        onClick={() => setChecklistCollapsed(!checklistCollapsed)}
        className="w-full flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="mt-0.5 h-5 w-5 text-green" strokeWidth={3} />
          <h2 className="text-lg font-semibold">Checklist</h2>
          {checklistCollapsed ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            readinessComplete
              ? "bg-green/20 text-green-800"
              : "bg-yellow-100 text-yellow-800",
          )}
        >
          {readinessReadyCount}/{readinessTotalCount} ready
        </span>
      </button>
      {!checklistCollapsed && (
        <ul className="mt-4 divide-y divide-gray-200">
          {readinessChecklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-4">
              {item.isReady ? (
                <CheckIcon className="h-5 w-5 text-green" strokeWidth={3} />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default ActionReadinessChecklist;
