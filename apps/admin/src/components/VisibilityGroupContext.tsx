import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { ArrowDownToLine, ArrowUpToLine, Unlink } from "lucide-react";
import { createContext, useContext } from "react";
import {
  detachMember,
  joinNeighbor,
  NeighborDirection,
  sameVisibility,
  type GroupedPages,
  type VisibilityGroups,
} from "../lib/visibilityGroups";

export enum VisibilityGroupRoleKind {
  Member = "member",
  Single = "single",
}

type JoinOption = { join: () => void; replacesOwn: boolean };

type VisibilityGroupRole =
  | { kind: VisibilityGroupRoleKind.Member; detach: () => void }
  | {
      kind: VisibilityGroupRoleKind.Single;
      joins: Record<NeighborDirection, JoinOption | null>;
    };

const JOIN_ICONS: Record<NeighborDirection, typeof ArrowUpToLine> = {
  [NeighborDirection.Previous]: ArrowUpToLine,
  [NeighborDirection.Next]: ArrowDownToLine,
};

// Carries the id of the top-level element it describes, so an editor under it
// for anything else doesn't take it as its own.
export const VisibilityGroupContext = createContext<
  ({ elementId: string } & VisibilityGroupRole) | null
>(null);

export function visibilityGroupRole({
  pages,
  pageIndex,
  index,
  groups,
  setGroups,
  applyGrouped,
}: {
  pages: Page[];
  pageIndex: number;
  index: number;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  applyGrouped: (grouped: GroupedPages) => void;
}): ({ elementId: string } & VisibilityGroupRole) | null {
  const fields = pages[pageIndex]?.fields ?? [];
  const field = fields[index];
  if (!field?.id) return null;
  const elementId = field.id;
  if (groups.has(elementId)) {
    return {
      elementId,
      kind: VisibilityGroupRoleKind.Member,
      detach: () => setGroups(detachMember(groups, elementId)),
    };
  }
  const joinWith = (neighbor: PageItem | undefined): JoinOption | null =>
    neighbor?.id && neighbor.visibleIfFormula
      ? {
          join: () =>
            applyGrouped(
              joinNeighbor({ pages, groups, element: field, neighbor }),
            ),
          replacesOwn:
            field.visibleIfFormula != null &&
            !sameVisibility(field.visibleIfFormula, neighbor.visibleIfFormula),
        }
      : null;
  return {
    elementId,
    kind: VisibilityGroupRoleKind.Single,
    joins: {
      [NeighborDirection.Previous]: joinWith(fields[index - 1]),
      [NeighborDirection.Next]: joinWith(fields[index + 1]),
    },
  };
}

export function useVisibilityGroupRole(
  elementId: string | undefined,
): VisibilityGroupRole | null {
  const role = useContext(VisibilityGroupContext);
  return role && elementId && role.elementId === elementId ? role : null;
}

export function useVisibilityGroupMember(elementId: string | undefined) {
  const role = useVisibilityGroupRole(elementId);
  return role?.kind === VisibilityGroupRoleKind.Member ? role : null;
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

export function JoinVisibilityButtons({
  elementId,
}: {
  elementId: string | undefined;
}) {
  const role = useVisibilityGroupRole(elementId);
  if (role?.kind !== VisibilityGroupRoleKind.Single) return null;
  return Object.values(NeighborDirection).map((neighbor) => {
    const option = role.joins[neighbor];
    const Icon = JOIN_ICONS[neighbor];
    if (!option) return null;
    const label = option.replacesOwn
      ? `Use the ${neighbor} element's visibility, replacing this element's`
      : `Share the ${neighbor} element's visibility`;
    return (
      <button
        key={neighbor}
        type="button"
        onClick={option.join}
        title={label}
        aria-label={label}
        className="text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  });
}
