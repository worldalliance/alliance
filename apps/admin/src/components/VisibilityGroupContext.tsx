import type { PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { Settings2, Unlink } from "lucide-react";
import { createContext, useContext } from "react";
import { detachMember, type VisibilityGroups } from "../lib/visibilityGroups";
import { SharedRuleSummary } from "./form-canvas/VisibilityGroupPanel";

type VisibilityGroupMember = {
  elementId: string;
  summary: string;
  openGroup: () => void;
  detach: () => void;
};

// Carries the id of the top-level element it describes, so an editor under it
// for anything else doesn't take it as its own.
export const VisibilityGroupContext =
  createContext<VisibilityGroupMember | null>(null);

export function visibilityGroupMember({
  element,
  groups,
  setGroups,
  summarize,
  onOpenGroup,
}: {
  element: PageItem;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  summarize: (formula: VisibleIfFormula) => string;
  onOpenGroup: (key: string) => void;
}): VisibilityGroupMember | null {
  const elementId = element.id;
  const key = elementId && groups.get(elementId);
  if (!elementId || !key || !element.visibleIfFormula) return null;
  return {
    elementId,
    summary: summarize(element.visibleIfFormula),
    openGroup: () => onOpenGroup(key),
    detach: () => setGroups(detachMember(groups, elementId)),
  };
}

export function useVisibilityGroupMember(elementId: string | undefined) {
  const member = useContext(VisibilityGroupContext);
  return member && elementId && member.elementId === elementId ? member : null;
}

export function SharedVisibilityNotice({
  summary,
  openGroup,
  detach,
}: Omit<VisibilityGroupMember, "elementId">) {
  return (
    <div className="flex items-start gap-2">
      <SharedRuleSummary heading="Shared visibility" summary={summary} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openGroup}
          aria-label="Edit in group settings"
          title="Edit in group settings"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={detach}
          aria-label="Edit visibility separately"
          title="Edit visibility separately"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Unlink className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
