import type { Page } from "@alliance/common/forms/form-schema";
import type { VisibilityGroups } from "../../../../lib/visibilityGroups";
import {
  CanvasTargetKind,
  type ResolvedTarget,
} from "../selection/canvasSelection";
import type { InsertLoc } from "./InsertPoint";

/**
 * Where "Add element below…" and `a` add: after the selection, inside the
 * visibility group of an element in one, after a whole group, and at the end
 * of the page when the page is selected.
 */
export function insertBelow({
  page,
  groups,
  selected,
}: {
  page: Page;
  groups: VisibilityGroups;
  selected: ResolvedTarget;
}): InsertLoc {
  const groupOf = (index: number) => {
    const id = page.fields[index]?.id;
    return (id && groups.get(id)) || null;
  };
  switch (selected.kind) {
    case CanvasTargetKind.Page:
      return { groupKey: null, index: page.fields.length };
    case CanvasTargetKind.Element:
      return { groupKey: groupOf(selected.index), index: selected.index + 1 };
    case CanvasTargetKind.Range:
      return { groupKey: groupOf(selected.end - 1), index: selected.end };
    case CanvasTargetKind.Group:
      return { groupKey: null, index: selected.end };
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(selected satisfies never)}`,
      );
  }
}
