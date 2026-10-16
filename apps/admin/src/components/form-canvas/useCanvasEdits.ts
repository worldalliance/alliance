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
} from "../../lib/copyWithUniqueIds";
import { reorderPages } from "../../lib/reorderPages";
import { updatePageElement } from "../../lib/updatePageElement";
import { moveItem } from "../../lib/useDragReorder";
import {
  deriveVisibilityGroups,
  type GroupedPages,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import { createDisplayBlock } from "../display-blocks";
import { createField } from "../form-fields/createField";
import {
  CanvasTargetKind,
  elementTarget,
  followElement,
  type ChildTarget,
} from "./canvasSelection";
import {
  InsertMode,
  type AvailableElement,
  type InsertLoc,
} from "./InsertPoint";
import { SidebarSection } from "./sidebarSections";
import type { CanvasSelectionState } from "./useCanvasSelection";
import { useGuardedDeletion } from "./useGuardedDeletion";
import type { ListMove } from "./useListDrag";

export function useCanvasEdits({
  schema,
  visibilityGroups,
  canvasGroups,
  updateSchema,
  canvas,
}: {
  schema: FormSchema;
  visibilityGroups: VisibilityGroups;
  /** The groups the canvas shows, which a display-only builder has none of. */
  canvasGroups: VisibilityGroups;
  updateSchema: (schema: FormSchema, groups?: VisibilityGroups) => void;
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
  } = canvas;

  const [insertion, setInsertion] = useState<{
    loc: InsertLoc;
    mode: InsertMode;
  } | null>(null);
  const closeInsertion = useCallback(() => setInsertion(null), []);

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
    const newFields = [...currentPage.fields];
    newFields.splice(index, 0, inserted);
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

  const replaceFields = (fields: PageItem[], pageIndex = selectedPageIndex) => {
    const before = schema.pages[pageIndex];
    if (!before) return;
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === pageIndex ? { ...page, fields } : page,
      ),
    });
    setSelection((current) =>
      current.pageId === before.id
        ? {
            ...current,
            target: followElement({
              before: before.fields,
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
    }
    replaceFields(currentPage.fields.filter((_, i) => i !== index));
  };

  const deleteElement = (index: number) =>
    guardDeletion(
      { kind: PlaceKind.Element, pageIndex: selectedPageIndex, index },
      () => removeElement(index),
    );

  const moveElement = (
    { from, dropIndex, position }: ListMove,
    pageIndex = selectedPageIndex,
  ) => {
    const moved = moveItem({
      items: schema.pages[pageIndex]?.fields ?? [],
      draggedIndex: from,
      dropIndex,
      position,
    });
    if (moved) replaceFields(moved.items, pageIndex);
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
    duplicateElement,
    applyGrouped,
    updateElementAt,
    selectChildOf,
  };
}
