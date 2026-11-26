import type { PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { createContext, useContext } from "react";
import { detachMember, type VisibilityGroups } from "../../../../lib/visibilityGroups";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { SharedRuleSummary } from "./VisibilityGroupPanel";

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
    <div className="flex flex-col gap-3">
      <SharedRuleSummary heading="Shared visibility" summary={summary} />
      <div className="flex flex-wrap gap-2">
        <Button variant={ButtonVariant.Default} size="small" onClick={openGroup}>
          Open group settings
        </Button>
        <Button variant={ButtonVariant.Default} size="small" onClick={detach}>
          Edit visibility separately
        </Button>
      </div>
    </div>
  );
}
