import { type DisplayKind } from "@alliance/common/forms/display-blocks";
import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type {
  FieldKind,
  FormSchema,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { useCallback, useEffect, useState } from "react";
import {
  collectSchemaIds,
  copyElementWithUniqueIds,
  copyPageWithUniqueIds,
  createUniqueFormBuilderId,
} from "../../../../lib/copyWithUniqueIds";
import { settleInserted } from "../../../../lib/formGroups";
import {
  moveElements,
  repeatedIds,
  type ElementDrop,
  type ElementSpan,
} from "../../../../lib/moveElements";
import { reorderPages } from "../../../../lib/reorderPages";
import { updatePageElement } from "../../../../lib/updatePageElement";
import { itemMove, type ListMove } from "../../../../lib/useDragReorder";
import {
  deriveVisibilityGroups,
  type GroupedPages,
  type VisibilityGroups,
} from "../../../../lib/visibilityGroups";
import { ToastVariant, useToast } from "../../../../ui/ToastProvider";
import { createDisplayBlock } from "../blocks";
import {
  InsertMode,
  type AvailableElement,
  type InsertLoc,
} from "../canvas/InsertPoint";
import type { ElementExpressionsMove } from "../conditions/expressionBuffers";
import { SidebarSection } from "../inspector/sidebarSections";
import { useGuardedDeletion } from "../inspector/useGuardedDeletion";
import { createField } from "../questions/createField";
import {
  CanvasTargetKind,
  elementTarget,
  followElement,
  type ChildTarget,
} from "./canvasSelection";
import { selectedSpan } from "./rangeSelection";
import type { CanvasSelectionState } from "./useCanvasSelection";

export function useCanvasEdits({
  schema,
  visibilityGroups,
  canvasGroups,
  updateSchema,
  moveExpressions,
  canvas,
}: {
  schema: FormSchema;
  visibilityGroups: VisibilityGroups;
  /** The groups the canvas shows, which a display-only builder has none of. */
  canvasGroups: VisibilityGroups;
  updateSchema: (schema: FormSchema, groups?: VisibilityGroups) => void;
  moveExpressions: (move: ElementExpressionsMove) => void;
  canvas: CanvasSelectionState;
}) {
  const {
    currentPage,
    selectedPageIndex,
    setSelectedPageIndex,
    setSelection,
    resolvedTarget,
    setSection,
    select,
    showPage,
    selectFromOutline,
    setFocusPending,
    reveal,
  } = canvas;

  const [insertion, setInsertion] = useState<{
    loc: InsertLoc;
    mode: InsertMode;
  } | null>(null);
  const closeInsertion = useCallback(() => setInsertion(null), []);

  const { showToast } = useToast();
  const { guard: guardDeletion, dialog: deletionDialog } = useGuardedDeletion({
    pages: schema.pages,
    groups: canvasGroups,
  });

  const applyInsert = (item: PageItem, loc: InsertLoc) => {
    const { index, groupKey } = loc;
    const groupFormula =
      groupKey == null
        ? undefined
        : currentPage.fields[index - 1]?.visibleIfFormula;
    const inserted =
      groupFormula && item.id
        ? { ...item, visibleIfFormula: groupFormula }
        : item;
    const newFields = settleInserted(
      [
        ...currentPage.fields.slice(0, index),
        inserted,
        ...currentPage.fields.slice(index),
      ],
      index,
    );
    updateSchema(
      {
        ...schema,
        pages: schema.pages.map((page, idx) =>
          idx === selectedPageIndex ? { ...page, fields: newFields } : page,
        ),
      },
      groupKey != null && inserted.id
        ? new Map(visibilityGroups).set(inserted.id, groupKey)
        : undefined,
    );
  };
  const insertAndSelect = (item: PageItem, loc: InsertLoc) => {
    applyInsert(item, loc);
    setInsertion(null);
    select(elementTarget(item, loc.index), SidebarSection.Content);
    setFocusPending(true);
  };

  const pickElement = (element: AvailableElement, loc: InsertLoc) => {
    switch (element.type) {
      case "field":
        addField(element.id, loc);
        break;
      case "block":
        addDisplayBlock(element.kind, loc);
        break;
      case "copy":
        setInsertion({ loc, mode: InsertMode.Copy });
        break;
      default:
        throw new Error(
          `Unknown element type: ${(element satisfies never as AvailableElement).type}`,
        );
    }
  };

  // An insert position is relative to the current page, so it can't survive a
  // page switch.
  useEffect(() => {
    setInsertion(null);
  }, [selectedPageIndex]);

  const addField = (kind: FieldKind, loc: InsertLoc) => {
    insertAndSelect(createField(kind, `field-${Date.now()}`), loc);
  };

  const addDisplayBlock = (kind: DisplayKind, loc: InsertLoc) => {
    insertAndSelect(createDisplayBlock(kind, `block-${Date.now()}`), loc);
  };

  const updateCurrentPage = (updates: Partial<Page>) => {
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, ...updates } : page,
      ),
    });
  };

  const addPage = () => {
    const pageNumber = schema.pages.length + 1;
    const newPage: Page = {
      id: createUniqueFormBuilderId("page", collectSchemaIds(schema)),
      title: `Page ${pageNumber}`,
      fields: [],
    };
    updateSchema({
      ...schema,
      pages: [...schema.pages, newPage],
    });
    selectFromOutline({
      page: newPage,
      pageIndex: schema.pages.length,
      target: { kind: CanvasTargetKind.Page },
    });
    setFocusPending(true);
  };

  const movePage = ({ from, dropIndex, position }: ListMove) => {
    const moved = reorderPages({
      pages: schema.pages,
      draggedIndex: from,
      dropIndex,
      position,
      selectedIndex: selectedPageIndex,
    });
    if (moved) {
      updateSchema({ ...schema, pages: moved.pages });
      setSelectedPageIndex(moved.selectedIndex);
    }
  };

  const copyPage = (pageIndex: number) => {
    const sourcePage = schema.pages[pageIndex];
    if (!sourcePage) return;

    const copiedPage = copyPageWithUniqueIds(sourcePage, schema);
    const nextPages = [...schema.pages];
    const copiedPageIndex = pageIndex + 1;
    nextPages.splice(copiedPageIndex, 0, copiedPage);

    updateSchema(
      { ...schema, pages: nextPages },
      new Map([...visibilityGroups, ...deriveVisibilityGroups([copiedPage])]),
    );
    showPage(copiedPage, copiedPageIndex);
  };

  const removePage = (pageIndex: number) => {
    if (schema.pages.length <= 1) return;
    updateSchema({
      ...schema,
      pages: schema.pages.filter((_, i) => i !== pageIndex),
    });
  };

  const replaceFields = (fields: PageItem[]) => {
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, fields } : page,
      ),
    });
    setSelection((current) =>
      current.pageId === currentPage.id
        ? {
            ...current,
            target: followElement({
              before: currentPage.fields,
              after: fields,
              target: current.target,
            }),
          }
        : current,
    );
  };

  const removeElement = (index: number) => {
    if (
      resolvedTarget.kind === CanvasTargetKind.Element &&
      resolvedTarget.index === index
    ) {
      setSection(SidebarSection.Content);
      setFocusPending(true);
    }
    replaceFields(currentPage.fields.filter((_, i) => i !== index));
  };

  const deleteElement = (index: number) =>
    guardDeletion(
      { kind: PlaceKind.Element, pageIndex: selectedPageIndex, index },
      () => removeElement(index),
    );

  const moveElementsTo = (from: ElementSpan, to: ElementDrop) => {
    const pages = moveElements({ pages: schema.pages, from, to });
    if (!pages) return;
    // Selection and unfinished expression text find an element by its page's
    // id and its own, so a repeated one could carry them to the wrong element.
    const repeated =
      from.pageIndex === to.pageIndex ? [] : repeatedIds(schema.pages);
    if (repeated.length > 0) {
      showToast({
        variant: ToastVariant.Error,
        message: `Moving to another page needs unique ids, and these repeat: ${repeated.map((id) => JSON.stringify(id)).join(", ")}`,
        durationMs: null,
      });
      return;
    }
    updateSchema({ ...schema, pages });
    const source = schema.pages[from.pageIndex]!;
    if (from.pageIndex !== to.pageIndex) {
      moveExpressions({
        from: source.id,
        to: pages[to.pageIndex]!.id,
        ids: source.fields
          .slice(from.start, from.end)
          .flatMap((element) => (element.id ? [element.id] : [])),
      });
    }
    const span = selectedSpan(resolvedTarget);
    const carried =
      from.pageIndex !== to.pageIndex &&
      selectedPageIndex === from.pageIndex &&
      span !== null &&
      span.start >= from.start &&
      span.end <= from.end;
    if (carried) {
      setSelectedPageIndex(to.pageIndex);
      reveal();
      setSelection((current) => ({
        pageId: pages[to.pageIndex]!.id,
        target: followElement({
          before: source.fields,
          after: pages[to.pageIndex]!.fields,
          target: current.target,
        }),
      }));
      return;
    }
    setSelection((current) => {
      const at = [from.pageIndex, to.pageIndex].find(
        (index) => schema.pages[index]!.id === current.pageId,
      );
      return at === undefined
        ? current
        : {
            ...current,
            target: followElement({
              before: schema.pages[at]!.fields,
              after: pages[at]!.fields,
              target: current.target,
            }),
          };
    });
  };

  const moveElement = (move: ListMove) => {
    const { start, end, index } = itemMove(move);
    moveElementsTo(
      { pageIndex: selectedPageIndex, start, end },
      { pageIndex: selectedPageIndex, index },
    );
  };

  const duplicateElement = (index: number) => {
    const element = currentPage.fields[index];
    if (!element) return;
    insertAndSelect(copyElementWithUniqueIds(element, schema), {
      groupKey: (element.id && canvasGroups.get(element.id)) || null,
      index: index + 1,
    });
  };

  const applyGrouped = ({ pages, groups }: GroupedPages) =>
    updateSchema({ ...schema, pages }, groups);

  const updateElementAt = (index: number) => (updates: Partial<PageItem>) =>
    updateSchema({
      ...schema,
      pages: updatePageElement({
        pages: schema.pages,
        pageIndex: selectedPageIndex,
        index,
        updates,
      }),
    });

  const selectChildOf =
    (index: number) => (child: ChildTarget, options?: { focus: true }) => {
      const element = currentPage.fields[index];
      if (!element) return;
      select(
        { ...elementTarget(element, index), child },
        SidebarSection.Content,
      );
      if (options?.focus) setFocusPending(true);
    };

  return {
    insertion,
    setInsertion,
    closeInsertion,
    guardDeletion,
    deletionDialog,
    insertAndSelect,
    pickElement,
    updateCurrentPage,
    addPage,
    movePage,
    copyPage,
    removePage,
    deleteElement,
    moveElement,
    moveElementsTo,
    duplicateElement,
    applyGrouped,
    updateElementAt,
    selectChildOf,
  };
}

export type CanvasEdits = ReturnType<typeof useCanvasEdits>;
