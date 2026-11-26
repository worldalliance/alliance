import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { flowStepPreviews } from "@alliance/shared/forms/flowScreens";
import { Plus } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { copyElementWithUniqueIds } from "../../../../lib/copyWithUniqueIds";
import type { IssueIndex } from "../../../../lib/formIssues";
import { useConditionFieldLookup } from "../../../../lib/useConditionFieldLookup";
import { summarizeVisibility } from "../../../../lib/visibilitySummary";
import { useBuilder } from "../BuilderContext";
import { insertBelow } from "./insertBelow";
import { useSelectionActions } from "../inspector/useSelectionActions";
import { useShortcutInShell } from "../../../../shell/shortcuts";
import Button, { ButtonVariant } from "../../../../ui/Button";
import type { ContentOverride } from "./CanvasElement";
import { FormCanvas } from "./FormCanvas";
import { FormOutline } from "../outline/FormOutline";
import {
  AVAILABLE_ELEMENTS,
  DISPLAY_ONLY_ELEMENTS,
  InsertMode,
  InsertPoint,
  sameInsertLoc,
  type InsertLoc,
} from "./InsertPoint";
import { SECTION_ON_SELECT } from "../selection/useCanvasSelection";
import { FormBuilderSettings } from "../inspector/FormBuilderSettings";

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
  taskFlow,
  children,
}: Omit<
  ComponentProps<typeof FormBuilderSettings>,
  "conditionFieldOf" | "summarize"
> & {
  issueIndex: IssueIndex;
  override: ContentOverride | null;
  /** Shows how each page maps onto the full-screen task flow. */
  taskFlow: boolean;
  /** Lays out the outline, canvas and settings in the builder's panes. */
  children: (parts: {
    outline: ReactNode;
    /** The outline pane header's action. */
    outlineAction: ReactNode;
    canvas: ReactNode;
    settings: ReactNode;
  }) => ReactNode;
}) {
  const {
    selectedPageIndex,
    currentPage,
    resolvedTarget,
    select,
    revealPending,
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
    moveElementsTo,
    updateElementAt,
  } = edits;
  const { isPreviewMode } = useBuilder();
  const actions = useSelectionActions();
  useShortcutInShell({
    keys: "a",
    label: "Add an element below the selection",
    run: () => {
      if (isPreviewMode) return;
      setInsertion({
        loc: insertBelow({
          page: currentPage,
          groups: canvasGroups,
          selected: resolvedTarget,
        }),
        mode: InsertMode.Search,
      });
    },
  });
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
      onPick={(element) => {
        pickElement(element, loc);
        // Copying opens its own choice first; anything else is added now.
        if (element.type !== "copy") canvas.reveal();
      }}
      pages={schema.pages}
      onCopy={(source) => {
        insertAndSelect(copyElementWithUniqueIds(source, schema), loc);
        canvas.reveal();
      }}
      prominent={options?.prominent}
    />
  );

  return children({
    outlineAction:
      displayOnly || isPreviewMode ? null : (
        <Button variant={ButtonVariant.Ghost} size="small" onClick={addPage}>
          <Plus aria-hidden="true" className="size-4" />
          Add page
        </Button>
      ),
    outline: (
      <FormOutline
        pages={schema.pages}
        groups={canvasGroups}
        displayOnly={displayOnly}
        pageIndex={selectedPageIndex}
        selected={resolvedTarget}
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
                })
        }
        issues={issueIndex}
        onMovePage={movePage}
        onMoveElements={moveElementsTo}
        actions={actions}
        reveal={revealPending}
        pagesOnly={isPreviewMode}
      />
    ),
    canvas: (
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
        actions={actions}
        step={
          taskFlow
            ? (flowStepPreviews(schema)[selectedPageIndex] ?? null)
            : null
        }
      />
    ),
    settings: (
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
    ),
  });
}
