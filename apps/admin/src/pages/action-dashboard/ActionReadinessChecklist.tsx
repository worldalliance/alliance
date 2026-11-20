import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { AlertTriangle, CheckIcon, ChevronDown, ChevronUp } from "lucide-react";
import React, { useId, useMemo } from "react";
import type { FormWithSchema } from "../../components/FormResponsesView";
import StatusPill from "../../components/ui/StatusPill";
import { StatusTone } from "../../lib/statusTone";
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
  collapsed,
  onCollapsedChange,
}) => {
  const listId = useId();
  const items = useMemo<ReadinessCheckItem[]>(
    () =>
      action ? actionReadinessItems(action, taskForm?.schema ?? null) : [],
    [action, taskForm],
  );
  const missing = items.filter((item) => !item.isReady);

  if (items.length === 0) return null;

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-zinc-900">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : listId}
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex items-center gap-1 rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {collapsed ? (
              <ChevronDown size={16} aria-hidden />
            ) : (
              <ChevronUp size={16} aria-hidden />
            )}
            Checklist
          </button>
        </h2>
        <StatusPill
          tone={
            missing.length === 0 ? StatusTone.Positive : StatusTone.Attention
          }
          label={`${items.length - missing.length}/${items.length} ready`}
        />
        {collapsed && missing.length > 0 && (
          <p className="text-sm text-zinc-600">
            Missing: {missing.map((item) => item.summary).join(", ")}
          </p>
        )}
      </div>
      {!collapsed && (
        <ul id={listId} className="mt-2 divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              {item.isReady ? (
                <CheckIcon
                  className="size-4 text-green-700"
                  role="img"
                  aria-label="Ready"
                />
              ) : (
                <AlertTriangle
                  className="size-4 text-amber-600"
                  role="img"
                  aria-label="Missing"
                />
              )}
              <p className="text-sm text-zinc-900">{item.label}</p>
              {item.required && (
                <span className="text-xs text-zinc-500">
                  Required for staff testing
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ActionReadinessChecklist;
