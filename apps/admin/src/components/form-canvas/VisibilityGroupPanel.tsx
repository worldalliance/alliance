import type { AnyField, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { Scissors, Ungroup, Unlink } from "lucide-react";
import { ConditionalVisibility } from "../form-fields/conditions/ConditionalVisibility";
import { SectionPanels } from "./sidebarSections";

type GroupMember = {
  label: string;
  select: () => void;
  detach: () => void;
  /** Starts a group of its own from this member on. */
  splitBefore: () => void;
};

type VisibilityGroupPanelProps = {
  firstMember: PageItem;
  members: GroupMember[];
  summary: string;
  previousFields: AnyField[];
  laterFields: AnyField[];
  onChangeVisibility: (formula: VisibleIfFormula | undefined) => void;
  onUngroup: () => void;
  errors: string[];
};

export function VisibilityGroupPanel({
  firstMember,
  members,
  summary,
  previousFields,
  laterFields,
  onChangeVisibility,
  onUngroup,
  errors,
}: VisibilityGroupPanelProps) {
  return (
    <SectionPanels
      content={
        <ol aria-label="Group members" className="space-y-1">
          {members.map((member, offset) => (
            <li key={offset}>
              {offset > 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={member.splitBefore}
                    aria-label={`Split group before ${member.label}`}
                    title={`Split group before ${member.label}`}
                    className="rounded p-1 text-gray-400 hover:bg-amber-100 hover:text-gray-700"
                  >
                    <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1">
                <button
                  type="button"
                  onClick={member.select}
                  className="min-w-0 flex-1 truncate text-left text-sm text-gray-800 hover:text-blue-700"
                >
                  {member.label}
                </button>
                <button
                  type="button"
                  onClick={member.detach}
                  aria-label={`Edit ${member.label}'s visibility separately`}
                  title={`Edit ${member.label}'s visibility separately`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Unlink className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      }
      conditions={
        <>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                Shared visibility · {withCount(members.length, "element")}
              </p>
              <p className="break-words text-sm text-gray-700">
                Shown when {summary}
              </p>
            </div>
            <div className="flex items-center gap-1">
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

          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 text-sm text-red-700">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}

          <ConditionalVisibility
            field={firstMember}
            previousFields={previousFields}
            laterFields={laterFields}
            onChange={({ visibleIfFormula }) =>
              onChangeVisibility(visibleIfFormula)
            }
          />
        </>
      }
    />
  );
}
