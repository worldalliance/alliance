import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { ErrorState } from "../../../ui/templates/States";
import { PaneHeader, Workspace } from "../../../ui/templates/Workspace";
import { AggregateBuilder } from "./aggregates/AggregateBuilder";
import { useBuilder } from "./BuilderContext";
import {
  CanvasSkeleton,
  InspectorSkeleton,
  OutlineSkeleton,
} from "./BuilderSkeletons";
import { BuilderToolbar } from "./BuilderToolbar";
import { selectedOnCanvas } from "./canvas/CanvasWorkspace";
import { PreviewBoundary } from "./canvas/ElementBoundary";
import { FormBuilderCanvas } from "./canvas/FormBuilderCanvas";
import { VariableBuilder } from "./formulas/VariableBuilder";
import { revealInPane } from "./kit/revealInPane";
import { MainPaneHeader } from "./MainPaneHeader";
import { useOutputPanes } from "./outputs/OutputBuilder";
import { pageChunks } from "./pageChunks";
import { DisplayOnlyPreview } from "./preview/DisplayOnlyPreview";
import { FormBuilderPreview } from "./preview/FormBuilderPreview";
import { RowListBuilder } from "./rows/RowListBuilder";
import { useRestoreFocusWithin } from "./selection/useRestoreFocusWithin";
import { ShareableTextBuilder } from "./shareable/ShareableTextBuilder";
import { useCanvasScrollMemory } from "./useCanvasScrollMemory";
import { useFillHeight } from "./useFillHeight";
import { FormEditor } from "./useFormBuilder";
import { useSettleGate } from "./useSettleGate";

const EDITOR_TITLES: Record<FormEditor, string> = {
  [FormEditor.Form]: "Form",
  [FormEditor.Shareable]: "Shareable text",
  [FormEditor.Outputs]: "Output views",
  [FormEditor.Aggregates]: "Aggregate views",
  [FormEditor.Variables]: "Formulas",
  [FormEditor.Rows]: "Rows",
};

/** A pane's own scroller under its header, so nothing but the pane scrolls. */
const PANE_SCROLL = "min-h-0 flex-1 overflow-x-hidden overflow-y-auto";

/**
 * The builder's three panes under its toolbar: outline, canvas and settings on
 * the Form tab, outline and preview in Preview, and one pane on the others.
 * It fills its parent and never scrolls with it.
 */
export function BuilderWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(rootRef);
  return (
    <div
      ref={rootRef}
      style={height === null ? undefined : { height, flex: "none" }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <Panes />
    </div>
  );
}

function OtherEditor({ editor }: { editor: FormEditor }) {
  const { schema, updateSchema, schemaLoads } = useBuilder();
  switch (editor) {
    case FormEditor.Form:
      return null;
    case FormEditor.Shareable:
      return (
        <ShareableTextBuilder schema={schema} onSchemaChange={updateSchema} />
      );
    case FormEditor.Outputs:
      return null;
    case FormEditor.Aggregates:
      return <AggregateBuilder schema={schema} onSchemaChange={updateSchema} />;
    case FormEditor.Variables:
      return (
        <VariableBuilder
          key={schemaLoads}
          schema={schema}
          onSchemaChange={updateSchema}
        />
      );
    case FormEditor.Rows:
      return (
        <RowListBuilder
          key={schemaLoads}
          schema={schema}
          onSchemaChange={updateSchema}
        />
      );
    default:
      throw new Error(`unknown editor: ${editor satisfies never}`);
  }
}

/**
 * One Workspace for every editor, so switching editors keeps the toolbar, and
 * focus on its tabs, in place.
 */
function Panes() {
  const {
    schema,
    visibilityGroups,
    setGroups,
    canvasGroups,
    canvas,
    edits,
    updateBlockById,
    issueIndex,
    overrideTarget,
    override,
    setJsonScope,
    isPreviewMode,
    outline,
    activeEditor,
    updateSchema,
    schemaLoads,
    outputViewId,
    setOutputViewId,
    saved: { isLoading },
    loadFailure,
    props: { displayOnly, taskFlow },
  } = useBuilder();
  const settingsRef = useRef<HTMLDivElement>(null);
  const onForm = activeEditor === FormEditor.Form;
  const onOutputs = activeEditor === FormEditor.Outputs;
  const outputPanes = useOutputPanes({
    schema,
    onSchemaChange: updateSchema,
    onUpdateBlockById: updateBlockById,
    editorsKey: schemaLoads,
    selectedViewId: outputViewId,
    onSelectView: setOutputViewId,
    header: (title) => <MainPaneHeader title={title} />,
    active: onOutputs,
  });

  return (
    <FormBuilderCanvas
      schema={schema}
      displayOnly={displayOnly}
      visibilityGroups={visibilityGroups}
      setGroups={setGroups}
      canvasGroups={canvasGroups}
      canvas={canvas}
      edits={edits}
      updateBlockById={updateBlockById}
      issueIndex={issueIndex}
      overrideTarget={overrideTarget}
      override={override}
      onEditJson={setJsonScope}
      taskFlow={taskFlow}
    >
      {(parts) => (
        <Workspace
          toolbar={<BuilderToolbar />}
          navigator={
            onOutputs ? (
              outputPanes.navigator
            ) : !onForm || outline.hidden ? undefined : (
              <nav
                aria-label="Outline"
                className="flex min-h-0 flex-1 flex-col"
              >
                <PaneHeader title="Outline" action={parts.outlineAction} />
                <div className={PANE_SCROLL}>
                  {isLoading ? (
                    <OutlineSkeleton />
                  ) : (
                    loadFailure === null && parts.outline
                  )}
                </div>
              </nav>
            )
          }
          inspector={
            onOutputs ? (
              outputPanes.inspector
            ) : !onForm || isPreviewMode ? undefined : (
              <aside
                aria-label="Settings"
                className="flex min-h-0 flex-1 flex-col"
              >
                <div
                  ref={settingsRef}
                  tabIndex={-1}
                  className={cn(PANE_SCROLL, "outline-none")}
                >
                  {isLoading ? (
                    <InspectorSkeleton />
                  ) : (
                    loadFailure === null && parts.settings
                  )}
                </div>
              </aside>
            )
          }
        >
          {onForm ? (
            <FormCanvasPane
              canvasPart={parts.canvas}
              settingsRef={settingsRef}
            />
          ) : onOutputs ? (
            outputPanes.main
          ) : (
            <>
              <MainPaneHeader title={EDITOR_TITLES[activeEditor]} />
              <div className={cn(PANE_SCROLL, "p-card")}>
                <OtherEditor editor={activeEditor} />
              </div>
            </>
          )}
        </Workspace>
      )}
    </FormBuilderCanvas>
  );
}

/** The Form tab's canvas, which also keeps the settings pane in step with the selection. */
function FormCanvasPane({
  canvasPart,
  settingsRef,
}: {
  canvasPart: ReactNode;
  settingsRef: RefObject<HTMLDivElement | null>;
}) {
  const {
    canvas,
    isPreviewMode,
    reach,
    saved: { isLoading },
    loadFailure,
  } = useBuilder();
  const { currentPage, revealPending, revealed, selectionKey, selections } =
    canvas;
  const canvasRef = useRef<HTMLDivElement>(null);

  const view = `${currentPage.id}:${isPreviewMode ? "preview" : "edit"}`;
  useCanvasScrollMemory({ pane: canvasRef, view, revealing: revealPending });
  useEffect(() => {
    if (!revealPending) return;
    const pane = canvasRef.current;
    const selected = selectedOnCanvas(pane);
    if (pane && selected) revealInPane(pane, selected);
    revealed();
  }, [revealPending, revealed]);

  const restoreSettingsFocus = useRestoreFocusWithin(settingsRef);
  const shown = useRef({ key: selectionKey, selections });
  useEffect(() => {
    const previous = shown.current;
    shown.current = { key: selectionKey, selections };
    if (previous.key === selectionKey) return;
    // An element without an id is keyed by its index, so moving it changes the
    // key while the settings still show it: only a new selection scrolls up.
    if (previous.selections !== selections && settingsRef.current) {
      settingsRef.current.scrollTop = 0;
    }
    restoreSettingsFocus();
  }, [selectionKey, selections, restoreSettingsFocus, settingsRef]);

  const chunks = useCallback(() => pageChunks(currentPage), [currentPage]);
  const settled = useSettleGate({
    pane: canvasRef,
    key: view,
    ready: !isLoading && !reach.loading,
    chunks,
  });

  return (
    <>
      <MainPaneHeader />
      <div
        ref={canvasRef}
        role="region"
        aria-label={isPreviewMode ? "Preview" : "Form canvas"}
        className={cn(PANE_SCROLL, "relative", !isPreviewMode && "p-4 pb-16")}
      >
        {loadFailure ? (
          <div className="flex flex-col items-center">
            <ErrorState
              title="Couldn't load this form"
              reason={loadFailure.message}
            />
            <Button
              variant={ButtonVariant.Default}
              onClick={loadFailure.onRetry}
            >
              {loadFailure.retryLabel}
            </Button>
          </div>
        ) : (
          <Settling settled={settled}>
            {isPreviewMode ? <PreviewBody /> : canvasPart}
          </Settling>
        )}
      </div>
    </>
  );
}

/** The page rendered in place but hidden until it has laid out for good. */
function Settling({
  settled,
  children,
}: {
  settled: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div aria-busy={!settled} className={cn(!settled && "invisible")}>
        {children}
      </div>
      {!settled && <CanvasSkeleton />}
    </>
  );
}

function PreviewBody() {
  const {
    schema,
    selectedPageIndex,
    previewUserId,
    setPreviewUserId,
    props: { displayOnly, displayOnlyTitle },
  } = useBuilder();
  return displayOnly ? (
    <div className="mx-auto max-w-3xl">
      <PreviewBoundary resetKeys={[schema]}>
        <DisplayOnlyPreview schema={schema} title={displayOnlyTitle} />
      </PreviewBoundary>
    </div>
  ) : (
    <FormBuilderPreview
      schema={schema}
      pageIndex={selectedPageIndex}
      previewUserId={previewUserId}
      setPreviewUserId={setPreviewUserId}
    />
  );
}
