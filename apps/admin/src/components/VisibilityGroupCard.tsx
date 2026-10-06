import type { AnyField, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronRight,
  Ungroup,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NeighborDirection, sameVisibility } from "../lib/visibilityGroups";
import { ConditionalVisibility } from "./form-fields/conditions/ConditionalVisibility";

type MergeCandidate = { formula: VisibleIfFormula; summary: string };

type VisibilityGroupCardProps = {
  firstMember: PageItem;
  memberCount: number;
  formula: VisibleIfFormula;
  summary: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  previousFields: AnyField[];
  laterFields: AnyField[];
  onChangeVisibility: (formula: VisibleIfFormula | undefined) => void;
  onUngroup: () => void;
  mergeCandidates: Record<NeighborDirection, MergeCandidate | null>;
  onMerge: (params: {
    direction: NeighborDirection;
    formula: VisibleIfFormula;
  }) => void;
  errors: string[];
  children: ReactNode;
};

const MERGE_LABELS: Record<
  NeighborDirection,
  { merge: string; choose: string; Icon: typeof ArrowUpToLine }
> = {
  [NeighborDirection.Previous]: {
    merge: "Merge with the previous group",
    choose: "Use previous group's visibility",
    Icon: ArrowUpToLine,
  },
  [NeighborDirection.Next]: {
    merge: "Merge with the next group",
    choose: "Use next group's visibility",
    Icon: ArrowDownToLine,
  },
};

export function VisibilityGroupCard({
  firstMember,
  memberCount,
  formula,
  summary,
  collapsed,
  onToggleCollapsed,
  previousFields,
  laterFields,
  onChangeVisibility,
  onUngroup,
  mergeCandidates,
  onMerge,
  errors,
  children,
}: VisibilityGroupCardProps) {
  const [choosingMerge, setChoosingMerge] = useState<NeighborDirection | null>(
    null,
  );
  const startMerge = (direction: NeighborDirection) => {
    const candidate = mergeCandidates[direction];
    if (candidate && sameVisibility(candidate.formula, formula)) {
      onMerge({ direction, formula });
    } else {
      setChoosingMerge((current) => (current === direction ? null : direction));
    }
  };

  const neighbor = choosingMerge && mergeCandidates[choosingMerge];
  const own = { formula, summary };
  const mergeChoices: Record<NeighborDirection, MergeCandidate> | null =
    choosingMerge && neighbor
      ? {
          [NeighborDirection.Previous]: own,
          [NeighborDirection.Next]: own,
          [choosingMerge]: neighbor,
        }
      : null;

  return (
    <section
      aria-label="Visibility group"
      className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/40"
    >
      <div className="flex items-start gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand group" : "Collapse group"}
          title={collapsed ? "Expand group" : "Collapse group"}
          className="mt-0.5 rounded p-0.5 text-gray-500 hover:bg-amber-100"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
            Shared visibility · {withCount(memberCount, "element")}
          </p>
          <p className="text-sm text-gray-700 break-words">
            Shown when {summary}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {Object.values(NeighborDirection).map((direction) => {
            if (!mergeCandidates[direction]) return null;
            const { merge, Icon } = MERGE_LABELS[direction];
            return (
              <button
                key={direction}
                type="button"
                onClick={() => startMerge(direction)}
                aria-label={merge}
                title={merge}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-amber-100 hover:text-gray-700"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={onUngroup}
            aria-label="Ungroup all"
            title="Ungroup all, keeping each element's visibility"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-amber-100 hover:text-gray-700"
          >
            <Ungroup className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onChangeVisibility(undefined)}
            className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Clear visibility
          </button>
        </div>
      </div>

      {choosingMerge && mergeChoices && (
        <div className="mx-3 mt-2 flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-2">
          <p className="text-sm text-gray-700">
            These groups have different visibility. Merge using:
          </p>
          {Object.values(NeighborDirection).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => {
                setChoosingMerge(null);
                onMerge({
                  direction: choosingMerge,
                  formula: mergeChoices[direction].formula,
                });
              }}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-left text-sm hover:bg-blue-50"
            >
              <span className="font-medium">
                {MERGE_LABELS[direction].choose}
              </span>
              <span className="block text-gray-600">
                {mergeChoices[direction].summary}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoosingMerge(null)}
            className="self-start text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="mx-3 mt-2 space-y-1 text-sm text-red-700">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}

      {!collapsed && (
        <>
          <div className="px-3 pt-2">
            <ConditionalVisibility
              field={firstMember}
              previousFields={previousFields}
              laterFields={laterFields}
              onChange={({ visibleIfFormula }) =>
                onChangeVisibility(visibleIfFormula)
              }
            />
          </div>
          <div className="space-y-3 p-3 pl-6">{children}</div>
        </>
      )}
    </section>
  );
}
