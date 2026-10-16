import type { FormPlace } from "@alliance/common/forms/form-conditions";
import type { Page } from "@alliance/common/forms/form-schema";
import { useCallback, useState } from "react";
import { useSelectedPage } from "../../lib/useSelectedPage";
import type { VisibilityGroups } from "../../lib/visibilityGroups";
import {
  CanvasTargetKind,
  forgetPositions,
  placeTarget,
  resolveTarget,
  targetKey,
  type CanvasSelection,
  type CanvasTarget,
} from "./canvasSelection";
import { DrawerKind, useWideCanvasLayout } from "./CanvasWorkspace";
import { extendSelection, type Span } from "./rangeSelection";
import { SidebarSection } from "./sidebarSections";

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
  const [selection, setSelection] = useState<CanvasSelection>(() => ({
    pageId: pages[0]?.id ?? "",
    target: { kind: CanvasTargetKind.Page },
  }));
  const reloadEditors = useCallback(() => {
    setSchemaLoads((count) => count + 1);
    setSelection((current) => {
      const target = forgetPositions(current.target);
      return target === current.target ? current : { ...current, target };
    });
  }, []);
  const [placeOnLoad, setPlaceOnLoad] = useState<FormPlace | null>(null);
  const { selectedPageIndex, setSelectedPageIndex, keepPage } =
    useSelectedPage(pages);
  const [section, setSection] = useState(SidebarSection.Content);
  const wideCanvas = useWideCanvasLayout();
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [focusPending, setFocusPending] = useState(false);
  const focused = useCallback(() => setFocusPending(false), []);
  const [revealPending, setRevealPending] = useState(false);
  const revealed = useCallback(() => setRevealPending(false), []);

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
    if (!wideCanvas) setDrawer(DrawerKind.Settings);
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
    keepOutline = false,
  }: {
    page: Page;
    pageIndex: number;
    target: CanvasTarget;
    section?: SidebarSection;
    /** For adding to a selection, which takes more than one entry. */
    keepOutline?: boolean;
  }) => {
    setSelectedPageIndex(pageIndex);
    setSelection({ pageId: page.id, target });
    setSection(nextSection);
    setRevealPending(true);
    if (!keepOutline) setDrawer(wideCanvas ? null : DrawerKind.Settings);
  };

  if (placeOnLoad) {
    setPlaceOnLoad(null);
    selectFromOutline({
      page: pages[placeOnLoad.pageIndex]!,
      pageIndex: placeOnLoad.pageIndex,
      target: placeTarget(pages, placeOnLoad),
    });
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
    keepPage,
    currentPage,
    setSelection,
    resolvedTarget,
    selectionKey,
    section,
    setSection,
    wideCanvas,
    drawer,
    setDrawer,
    focusPending,
    setFocusPending,
    focused,
    revealPending,
    revealed,
    select,
    showPage,
    selectFromOutline,
    extendTo,
  };
}
