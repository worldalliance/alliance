import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type { PageItem } from "@alliance/common/forms/form-schema";
import {
  addressedWrite,
  type AddressedWrite,
  type BlockWriteById,
} from "../../../../lib/displayBlockById";
import { accordionWrites } from "../selection/accordionWrites";
import {
  ChildKind,
  childPlace,
  elementTarget,
  sectionBlockChild,
  sectionChild,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "../selection/canvasSelection";
import type { CanvasEdits } from "../selection/useCanvasEdits";
import type { CanvasSelectionState } from "../selection/useCanvasSelection";
import { neighborMoves } from "./ChildRows";
import { SidebarSection } from "./sidebarSections";
import { DELETION } from "./useGuardedDeletion";

/** How a child of the element at `index` on the current page writes and changes the selection. */
export function childWiring({
  canvas,
  edits,
  updateBlockById,
  element,
  index,
  child,
}: {
  canvas: CanvasSelectionState;
  edits: CanvasEdits;
  updateBlockById: BlockWriteById;
  element: PageItem;
  index: number;
  child: ResolvedChild;
}) {
  const { currentPage, selectedPageIndex, setSelection, select } = canvas;
  return {
    onUpdate: edits.updateElementAt(index),
    updateCurrent: addressedWrite(element, updateBlockById),
    /** Selects another child of the same element, as after a move or delete. */
    onReselect: (next: ChildTarget) =>
      setSelection({
        pageId: currentPage.id,
        target: { ...elementTarget(element, index), child: next },
      }),
    onSelectParent: () =>
      select(elementTarget(element, index), SidebarSection.Content),
    /** Runs a deletion, or holds it for confirmation when something reads the child. */
    guardDelete: (run: () => void) => {
      const place = childPlace({ pageIndex: selectedPageIndex, index, child });
      return place ? edits.guardDeletion(place, run) : run();
    },
  };
}

export type ChildWiring = ReturnType<typeof childWiring>;

/**
 * Moving and deleting a list's sub-field, an accordion's section or one of a
 * section's blocks. `remove` deletes at once; `onDelete` asks first when
 * something reads the child, then selects its parent.
 */
export function childActions({
  element,
  child,
  onUpdate,
  updateCurrent,
  onReselect,
  onSelectParent,
  guardDelete,
  onSection,
}: Omit<ChildWiring, "updateCurrent"> & {
  element: PageItem;
  child: ResolvedChild;
  updateCurrent: AddressedWrite | undefined;
  onSection: (section: SidebarSection) => void;
}) {
  const base = baseActions({
    element,
    child,
    onUpdate,
    updateCurrent,
    onReselect,
  });
  return {
    ...base,
    onDelete: () =>
      guardDelete(() => {
        base.remove();
        if (base.parent) onReselect(base.parent);
        else onSelectParent();
        onSection(SidebarSection.Content);
      }),
  };
}

function baseActions({
  element,
  child,
  onUpdate,
  updateCurrent,
  onReselect,
}: {
  element: PageItem;
  child: ResolvedChild;
  onUpdate: (updates: Partial<PageItem>) => void;
  updateCurrent: AddressedWrite | undefined;
  onReselect: (child: ChildTarget) => void;
}) {
  switch (child.kind) {
    case ChildKind.SubField: {
      if (element.kind !== "list")
        throw new Error("a sub-field outside a list");
      const fields = element.fields;
      const { index } = child;
      return {
        ...neighborMoves(fields, index, (next, to) => {
          onUpdate({ fields: next });
          onReselect(subFieldChild(next[to]!, to));
        }),
        deleteLabel: DELETION[PlaceKind.SubField].action,
        remove: () =>
          onUpdate({ fields: fields.filter((_, i) => i !== index) }),
        /** Where a delete lands; null to land on the element. */
        parent: null,
      };
    }
    case ChildKind.Section:
    case ChildKind.SectionBlock: {
      if (element.kind !== "accordion") {
        throw new Error("a section outside an accordion");
      }
      const sections = element.sections;
      const sectionIndex = child.section;
      const section = sections[sectionIndex]!;
      const { writeSections, updateSection } = accordionWrites({
        sections,
        onUpdate,
        updateCurrent,
      });
      if (child.kind === ChildKind.Section) {
        return {
          ...neighborMoves(sections, sectionIndex, (next, to) => {
            writeSections(() => next);
            onReselect(sectionChild(next[to]!, to));
          }),
          deleteLabel: "Delete section",
          remove: () =>
            writeSections((current) =>
              current.filter((_, i) => i !== sectionIndex),
            ),
          parent: null,
        };
      }
      const blocks = section.blocks;
      const blockIndex = child.block;
      return {
        ...neighborMoves(blocks, blockIndex, (next, to) => {
          updateSection(sectionIndex, () => ({ blocks: next }));
          onReselect(
            sectionBlockChild({
              section,
              sectionIndex,
              block: next[to]!,
              blockIndex: to,
            }),
          );
        }),
        deleteLabel: "Delete block",
        remove: () =>
          updateSection(sectionIndex, () => ({
            blocks: blocks.filter((_, i) => i !== blockIndex),
          })),
        parent: sectionChild(section, sectionIndex),
      };
    }
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
}
