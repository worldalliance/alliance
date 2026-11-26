import { PlaceKind } from "@alliance/common/forms/form-conditions";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import {
  CanvasTargetKind,
  pageTitle,
} from "../../../../components/form-canvas/canvasSelection";
import { InsertMode } from "../../../../components/form-canvas/InsertPoint";
import { InspectorScope } from "../../../../components/form-canvas/useCanvasSelection";
import { DELETION } from "../../../../components/form-canvas/useGuardedDeletion";
import { JsonScopeKind } from "../../../../lib/formJson";
import { DropPosition } from "../../../../lib/useDragReorder";
import { NeighborDirection, stepPast } from "../../../../lib/visibilityGroups";
import { useBuilder } from "../BuilderContext";
import { insertBelow } from "../canvas/insertBelow";
import { revealInPane } from "../kit/revealInPane";
import type { ElementActions } from "./ElementActionsMenu";

const NONE: Omit<ElementActions, "deleteLabel"> = {
  moveNoun: null,
  onMoveUp: null,
  onMoveDown: null,
  moveToPage: null,
  duplicateLabel: "Duplicate",
  onDuplicate: null,
  onAddBelow: null,
  editJsonLabel: "Edit element JSON…",
  onEditJson: null,
  onShowInOutline: null,
  onDelete: null,
};

/** Scrolls only the outline, to its current row. */
function showInOutline() {
  const outline = document.querySelector('nav[aria-label="Outline"]');
  const pane = outline?.querySelector<HTMLElement>(".overflow-y-auto");
  const row = outline?.querySelector<HTMLElement>('[aria-current="true"]');
  if (pane && row) revealInPane(pane, row);
}

/**
 * The actions for the current selection, one source for the inspector header
 * and the outline's and canvas's context menus. Null for a selection whose
 * actions its own settings still offer: a list sub-field, accordion section
 * or section block, and the form itself.
 */
export function useSelectionActions(): ElementActions | null {
  const {
    schema,
    canvas,
    edits,
    canvasGroups,
    setJsonScope,
    outline,
    props: { displayOnly },
  } = useBuilder();
  const { resolvedTarget: target, currentPage, selectedPageIndex } = canvas;
  const pages = schema.pages;

  const moveToPage = (start: number, end: number) =>
    displayOnly || pages.length < 2
      ? null
      : {
          pages: pages.flatMap((page, index) =>
            index === selectedPageIndex
              ? []
              : [{ index, title: pageTitle(page) }],
          ),
          onMove: (pageIndex: number) =>
            edits.moveElementsTo(
              { pageIndex: selectedPageIndex, start, end },
              { pageIndex, index: pages[pageIndex]!.fields.length },
            ),
        };
  const shownInOutline = outline.hidden ? null : showInOutline;
  const addBelow = () =>
    edits.setInsertion({
      loc: insertBelow({
        page: currentPage,
        groups: canvasGroups,
        selected: target,
      }),
      mode: InsertMode.Search,
    });

  if (canvas.inspectorScope === InspectorScope.Form) return null;
  switch (target.kind) {
    case CanvasTargetKind.Page: {
      if (displayOnly) return null;
      const last = pages.length - 1;
      const movePage = (dropIndex: number, position: DropPosition) => () =>
        edits.movePage({ from: selectedPageIndex, dropIndex, position });
      return {
        ...NONE,
        moveNoun: "page",
        onMoveUp:
          selectedPageIndex > 0
            ? movePage(selectedPageIndex - 1, DropPosition.Before)
            : null,
        onMoveDown:
          selectedPageIndex < last
            ? movePage(selectedPageIndex + 1, DropPosition.After)
            : null,
        duplicateLabel: "Copy page",
        onDuplicate: () => edits.copyPage(selectedPageIndex),
        editJsonLabel: "Edit page JSON…",
        onEditJson: () =>
          setJsonScope({
            kind: JsonScopeKind.Page,
            pageIndex: selectedPageIndex,
          }),
        onShowInOutline: shownInOutline,
        deleteLabel: DELETION[PlaceKind.Page].action,
        onDelete:
          pages.length > 1
            ? () =>
                edits.guardDeletion(
                  { kind: PlaceKind.Page, pageIndex: selectedPageIndex },
                  () => edits.removePage(selectedPageIndex),
                )
            : null,
        deleteDisabledReason: "A form needs at least one page",
      };
    }
    case CanvasTargetKind.Element: {
      if (target.child) return null;
      const { index } = target;
      const element = currentPage.fields[index];
      if (!element) return null;
      const stepTo = (direction: NeighborDirection) => {
        const step = stepPast({
          fields: currentPage.fields,
          groups: canvasGroups,
          index,
          direction,
        });
        return step && (() => edits.moveElement({ from: index, ...step }));
      };
      return {
        ...NONE,
        onMoveUp: stepTo(NeighborDirection.Previous),
        onMoveDown: stepTo(NeighborDirection.Next),
        moveToPage: moveToPage(index, index + 1),
        onDuplicate: () => edits.duplicateElement(index),
        onAddBelow: addBelow,
        onEditJson: () =>
          setJsonScope({
            kind: JsonScopeKind.Element,
            pageIndex: selectedPageIndex,
            index,
          }),
        onShowInOutline: shownInOutline,
        deleteLabel: isQuestionField(element)
          ? DELETION[PlaceKind.Element].action
          : "Delete block",
        onDelete: () => edits.deleteElement(index),
      };
    }
    case CanvasTargetKind.Range:
    case CanvasTargetKind.Group:
      return {
        ...NONE,
        moveToPage: moveToPage(target.start, target.end),
        onAddBelow: addBelow,
        onShowInOutline: shownInOutline,
        deleteLabel: "",
      };
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}
