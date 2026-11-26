import type { FormPlace } from "@alliance/common/forms/form-conditions";
import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { useCallback, useState } from "react";
import { useSelectedPage } from "../../../../lib/useSelectedPage";
import type { VisibilityGroups } from "../../../../lib/visibilityGroups";
import { SidebarSection } from "../inspector/sidebarSections";
import {
  CanvasTargetKind,
  forgetPositions,
  placeTarget,
  resolveTarget,
  targetKey,
  type CanvasSelection,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import { extendSelection, type Span } from "./rangeSelection";

/** The element the selection starts at, whose position history travel may shift. */
function heldElement(page: Page, resolved: ResolvedTarget): PageItem | null {
  switch (resolved.kind) {
    case CanvasTargetKind.Page:
      return null;
    case CanvasTargetKind.Element:
      return page.fields[resolved.index] ?? null;
    case CanvasTargetKind.Range:
      return page.fields[resolved.anchor] ?? null;
    case CanvasTargetKind.Group:
      return page.fields[resolved.start] ?? null;
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(resolved satisfies never)}`,
      );
  }
}

/** `target` once the element it holds sits at `index`, or null for the page. */
function followHeld(target: CanvasTarget, index: number): CanvasTarget | null {
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return null;
    case CanvasTargetKind.Element:
      return { ...target, index };
    case CanvasTargetKind.Group:
      return target;
    case CanvasTargetKind.Range:
      return followHeld(forgetPositions(target), index);
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

/** What the inspector shows: the form's own settings, or the canvas selection's. */
export enum InspectorScope {
  Form = "form",
  Selection = "selection",
}

export const SECTION_ON_SELECT: Record<CanvasTargetKind, SidebarSection> = {
  [CanvasTargetKind.Page]: SidebarSection.Content,
  [CanvasTargetKind.Element]: SidebarSection.Content,
  [CanvasTargetKind.Group]: SidebarSection.Conditions,
  [CanvasTargetKind.Range]: SidebarSection.Conditions,
};

export function useCanvasSelection({
  pages,
  groups,
}: {
  pages: Page[];
  groups: VisibilityGroups;
}) {
  // Editors that keep their own copy of a formula or its text only follow it
  // through their own edits, so a schema loaded from the server, a conflict,
  // or pasted JSON, or restored by undo or redo, remounts them.
  const [schemaLoads, setSchemaLoads] = useState(0);
  const [selection, setSelectionState] = useState<CanvasSelection>(() => ({
    pageId: pages[0]?.id ?? "",
    target: { kind: CanvasTargetKind.Page },
  }));
  const reloadEditors = useCallback(() => {
    setSchemaLoads((count) => count + 1);
    setSelectionState((current) => {
      const target = forgetPositions(current.target);
      return target === current.target ? current : { ...current, target };
    });
  }, []);
  const [placeOnLoad, setPlaceOnLoad] = useState<FormPlace | null>(null);
  const { selectedPageIndex, setSelectedPageIndex, keepPage } =
    useSelectedPage(pages);
  const [section, setSection] = useState(SidebarSection.Content);
  const [inspectorScope, setInspectorScope] = useState(
    InspectorScope.Selection,
  );
  /** Counts new selections, which a structural edit's update isn't. */
  const [selections, setSelections] = useState(0);
  /** A new selection takes the inspector back from the form's settings; a structural edit's update doesn't. */
  const setSelection = (
    next: CanvasSelection | ((current: CanvasSelection) => CanvasSelection),
  ) => {
    if (typeof next !== "function") {
      setInspectorScope(InspectorScope.Selection);
      setSelections((count) => count + 1);
    }
    setSelectionState(next);
  };
  const [focusPending, setFocusPending] = useState(false);
  const focused = useCallback(() => setFocusPending(false), []);
  const [revealPending, setRevealPending] = useState(false);
  const revealed = useCallback(() => setRevealPending(false), []);
  const reveal = () => setRevealPending(true);

  const currentPage = pages[selectedPageIndex] ??
    pages?.[0] ?? { id: "page-1", title: "Page 1", fields: [] };
  const resolvedTarget = resolveTarget({
    page: currentPage,
    groups,
    selection,
  });
  const selectionKey = targetKey(currentPage, resolvedTarget);

  const select = (target: CanvasTarget, nextSection: SidebarSection) => {
    setSelection({ pageId: currentPage.id, target });
    setSection(nextSection);
  };

  const showPage = (page: Page, pageIndex: number) => {
    setSelectedPageIndex(pageIndex);
    setSelection({ pageId: page.id, target: { kind: CanvasTargetKind.Page } });
  };

  const selectFromOutline = ({
    page,
    pageIndex,
    target,
    section: nextSection = SECTION_ON_SELECT[target.kind],
    reveal: shouldReveal = true,
  }: {
    page: Page;
    pageIndex: number;
    target: CanvasTarget;
    section?: SidebarSection;
    reveal?: boolean;
  }) => {
    setSelectedPageIndex(pageIndex);
    setSelection({ pageId: page.id, target });
    setSection(nextSection);
    if (shouldReveal) reveal();
  };

  if (placeOnLoad) {
    setPlaceOnLoad(null);
    selectFromOutline({
      page: pages[placeOnLoad.pageIndex]!,
      pageIndex: placeOnLoad.pageIndex,
      target: placeTarget(pages, placeOnLoad),
    });
  }

  const [held, setHeld] = useState<PageItem | null>(null);
  const keepSelection = (move: () => void) => {
    keepPage(move);
    setHeld(heldElement(currentPage, resolvedTarget));
  };
  if (held) {
    setHeld(null);
    // Within a page the address finds the element as before; the element
    // itself is followed only onto another page, where the address can't.
    const page = pages.find((candidate) => candidate.fields.includes(held));
    const target =
      page &&
      page.id !== selection.pageId &&
      followHeld(selection.target, page.fields.indexOf(held));
    if (page && target) {
      setSelectedPageIndex(pages.indexOf(page));
      setSelection({ pageId: page.id, target });
      reveal();
    }
  }

  const extendTo = (clicked: Span, alone: CanvasTarget) =>
    extendSelection({
      fields: currentPage.fields,
      selected: resolvedTarget,
      clicked,
    }) ?? alone;

  return {
    schemaLoads,
    reloadEditors,
    selectPlace: setPlaceOnLoad,
    selectedPageIndex,
    setSelectedPageIndex,
    keepSelection,
    currentPage,
    setSelection,
    resolvedTarget,
    selectionKey,
    selections,
    section,
    setSection,
    inspectorScope,
    selectForm: () => setInspectorScope(InspectorScope.Form),
    focusPending,
    setFocusPending,
    focused,
    revealPending,
    revealed,
    reveal,
    select,
    showPage,
    selectFromOutline,
    extendTo,
  };
}

export type CanvasSelectionState = ReturnType<typeof useCanvasSelection>;
