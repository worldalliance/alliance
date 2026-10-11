import { Unlink } from "lucide-react";
import { createContext, useContext } from "react";
import { detachMember, type VisibilityGroups } from "../lib/visibilityGroups";

type VisibilityGroupMember = { elementId: string; detach: () => void };

// Carries the id of the top-level element it describes, so an editor under it
// for anything else doesn't take it as its own.
export const VisibilityGroupContext =
  createContext<VisibilityGroupMember | null>(null);

export function visibilityGroupMember({
  elementId,
  groups,
  setGroups,
}: {
  elementId: string | undefined;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
}): VisibilityGroupMember | null {
  if (!elementId || !groups.has(elementId)) return null;
  return {
    elementId,
    detach: () => setGroups(detachMember(groups, elementId)),
  };
}

export function useVisibilityGroupMember(elementId: string | undefined) {
  const member = useContext(VisibilityGroupContext);
  return member && elementId && member.elementId === elementId ? member : null;
}

export function SharedVisibilityNotice({ detach }: { detach: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-2 text-sm text-gray-600">
      <span>Visibility is shared with its group.</span>
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
  );
}
