import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import {
  AlertTriangle,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from "lucide-react";
import React, { useMemo } from "react";
import type { FormWithSchema } from "../../components/FormResponsesView";
import {
  actionReadinessItems,
  type ReadinessCheckItem,
} from "./actionReadiness";

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
  const readinessChecklist = useMemo<ReadinessCheckItem[]>(
    () =>
      action ? actionReadinessItems(action, taskForm?.schema ?? null) : [],
    [action, taskForm],
  );

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
