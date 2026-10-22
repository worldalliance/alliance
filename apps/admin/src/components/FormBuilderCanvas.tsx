import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import type { ComponentProps } from "react";
import { copyElementWithUniqueIds } from "../lib/copyWithUniqueIds";
import type { IssueIndex } from "../lib/formIssues";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { summarizeVisibility } from "../lib/visibilitySummary";
import type { ContentOverride } from "./form-canvas/CanvasElement";
import { CanvasWorkspace } from "./form-canvas/CanvasWorkspace";
import { FormCanvas } from "./form-canvas/FormCanvas";
import { FormOutline } from "./form-canvas/FormOutline";
import {
  AVAILABLE_ELEMENTS,
  DISPLAY_ONLY_ELEMENTS,
  InsertMode,
  InsertPoint,
  sameInsertLoc,
  type InsertLoc,
} from "./form-canvas/InsertPoint";
import { selectionIssues, SidebarIssues } from "./form-canvas/IssueList";
import { SECTION_ON_SELECT } from "./form-canvas/useCanvasSelection";
import { FormBuilderSettings } from "./FormBuilderSettings";

export function FormBuilderCanvas({
  schema,
  displayOnly,
  visibilityGroups,
  setGroups,
  canvasGroups,
  canvas,
  edits,
  updateBlockById,
  issueIndex,
  overrideTarget,
  override,
  onEditJson,
}: Omit<
  ComponentProps<typeof FormBuilderSettings>,
  "conditionFieldOf" | "summarize"
> & {
  issueIndex: IssueIndex;
  override: ContentOverride | null;
}) {
  const {
    selectedPageIndex,
    currentPage,
    resolvedTarget,
    selectionKey,
    wideCanvas,
    drawer,
    setDrawer,
    revealPending,
    revealed,
    select,
    selectFromOutline,
    extendTo,
  } = canvas;
  const {
    insertion,
    setInsertion,
    closeInsertion,
    insertAndSelect,
    pickElement,
    updateCurrentPage,
    addPage,
    movePage,
    moveElement,
    updateElementAt,
  } = edits;
  const availableElements = displayOnly
    ? DISPLAY_ONLY_ELEMENTS
    : AVAILABLE_ELEMENTS;

  const conditionFieldOf = useConditionFieldLookup(schema, currentPage);
  const summarize = (formula: VisibleIfFormula) =>
    summarizeVisibility(formula, conditionFieldOf);

  const renderInsertPoint = (loc: InsertLoc, options?: { prominent: true }) => (
    <InsertPoint
      loc={loc}
      mode={
        insertion && sameInsertLoc(insertion.loc, loc) ? insertion.mode : null
      }
      onOpen={() => setInsertion({ loc, mode: InsertMode.Search })}
      onClose={closeInsertion}
      elements={availableElements}
      onPick={(element) => pickElement(element, loc)}
      pages={schema.pages}
      onCopy={(source) =>
        insertAndSelect(copyElementWithUniqueIds(source, schema), loc)
      }
      prominent={options?.prominent}
    />
  );

  return (
    <CanvasWorkspace
      wide={wideCanvas}
      drawer={drawer}
      onDrawerChange={setDrawer}
      outline={
        <FormOutline
          pages={schema.pages}
          groups={canvasGroups}
          displayOnly={displayOnly}
          pageIndex={selectedPageIndex}
          selected={resolvedTarget}
          selectionKey={selectionKey}
          onSelect={(pageIndex, target) =>
            selectFromOutline({
              page: schema.pages[pageIndex]!,
              pageIndex,
              target,
            })
          }
          onExtend={
            displayOnly
              ? null
              : (clicked, alone) =>
                  selectFromOutline({
                    page: currentPage,
                    pageIndex: selectedPageIndex,
                    target: extendTo(clicked, alone),
                    keepOutline: true,
                  })
          }
          onCheck={
            displayOnly
              ? null
              : (pageIndex, target) =>
                  selectFromOutline({
                    page: schema.pages[pageIndex]!,
                    pageIndex,
                    target,
                    keepOutline: true,
                  })
          }
          issues={issueIndex}
          onAddPage={addPage}
          onMovePage={movePage}
          onMoveElement={(pageIndex, move) => moveElement(move, pageIndex)}
        />
      }
      revealPending={revealPending}
      onRevealed={revealed}
      canvasKey={currentPage.id}
      settingsKey={selectionKey}
      canvas={
        <FormCanvas
          page={currentPage}
          groups={canvasGroups}
          displayOnly={displayOnly}
          selected={resolvedTarget}
          onSelect={select}
          onExtend={
            displayOnly
              ? null
              : (clicked, alone) => {
                  const target = extendTo(clicked, alone);
                  select(target, SECTION_ON_SELECT[target.kind]);
                }
          }
          summarize={summarize}
          issues={issueIndex}
          pageIndex={selectedPageIndex}
          renderInsertPoint={renderInsertPoint}
          onMove={moveElement}
          onUpdateElement={(index, updates) => updateElementAt(index)(updates)}
          onUpdateBlockById={updateBlockById}
          onUpdatePage={updateCurrentPage}
          override={override}
        />
      }
      settings={
        <>
          <SidebarIssues
            messages={selectionIssues({
              index: issueIndex,
              page: currentPage,
              pageIndex: selectedPageIndex,
              target: resolvedTarget,
            })}
          />
          <FormBuilderSettings
            schema={schema}
            displayOnly={displayOnly}
            visibilityGroups={visibilityGroups}
            setGroups={setGroups}
            canvasGroups={canvasGroups}
            canvas={canvas}
            edits={edits}
            updateBlockById={updateBlockById}
            conditionFieldOf={conditionFieldOf}
            summarize={summarize}
            overrideTarget={overrideTarget}
            onEditJson={onEditJson}
          />
        </>
      }
    />
  );
}
