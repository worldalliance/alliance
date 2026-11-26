import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AggregateBuilder } from "../../../components/AggregateBuilder";
import { DisplayOnlyPreview } from "../../../components/DisplayOnlyPreview";
import { selectedOnCanvas } from "../../../components/form-canvas/CanvasWorkspace";
import { PreviewBoundary } from "../../../components/form-canvas/ElementBoundary";
import { useRestoreFocusWithin } from "../../../components/form-canvas/useRestoreFocusWithin";
import { FormBuilderCanvas } from "../../../components/FormBuilderCanvas";
import { FormBuilderPreview } from "../../../components/FormBuilderPreview";
import { OutputBuilder } from "../../../components/OutputBuilder";
import { RowListBuilder } from "../../../components/row-list/RowListBuilder";
import { ShareableTextBuilder } from "../../../components/ShareableTextBuilder";
import { VariableBuilder } from "../../../components/VariableBuilder";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { ErrorState } from "../../../ui/templates/States";
import { PaneHeader, Workspace } from "../../../ui/templates/Workspace";
import { useBuilder } from "./BuilderContext";
import {
  CanvasSkeleton,
  InspectorSkeleton,
  OutlineSkeleton,
} from "./BuilderSkeletons";
import { BuilderToolbar } from "./BuilderToolbar";
import { revealInPane } from "./kit/revealInPane";
import { MainPaneHeader } from "./MainPaneHeader";
import { pageChunks } from "./pageChunks";
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
  const builder = useBuilder();
  const rootRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(rootRef);
  const { activeEditor } = builder;
  return (
    <div
      ref={rootRef}
      style={height === null ? undefined : { height, flex: "none" }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {activeEditor === FormEditor.Form ? (
        <FormPanes />
      ) : activeEditor === FormEditor.Outputs ? (
        <OutputViews />
      ) : (
        <Workspace toolbar={<BuilderToolbar />}>
          <MainPaneHeader title={EDITOR_TITLES[activeEditor]} />
          <div className={cn(PANE_SCROLL, "p-card")}>
            <OtherEditor editor={activeEditor} />
          </div>
        </Workspace>
      )}
    </div>
  );
}

/** Output views fill all three panes, so they lay out their own workspace. */
function OutputViews() {
  const {
    schema,
    updateSchema,
    updateBlockById,
    schemaLoads,
    outputViewId,
    setOutputViewId,
  } = useBuilder();
  return (
    <OutputBuilder
      schema={schema}
      onSchemaChange={updateSchema}
      onUpdateBlockById={updateBlockById}
      editorsKey={schemaLoads}
      selectedViewId={outputViewId}
      onSelectView={setOutputViewId}
      toolbar={<BuilderToolbar />}
      header={(title) => <MainPaneHeader title={title} />}
    />
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

function FormPanes() {
  const builder = useBuilder();
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
    reach,
    saved: { isLoading },
    loadFailure,
    props: { displayOnly, taskFlow },
  } = builder;
  const { currentPage, revealPending, revealed, selectionKey } = canvas;
  const canvasRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useCanvasScrollMemory({
    pane: canvasRef,
    pageId: currentPage.id,
    revealing: revealPending,
  });
  useEffect(() => {
    if (!revealPending) return;
    const pane = canvasRef.current;
    const selected = selectedOnCanvas(pane);
    if (pane && selected) revealInPane(pane, selected);
    revealed();
  }, [revealPending, revealed]);

  const restoreSettingsFocus = useRestoreFocusWithin(settingsRef);
  const shownKey = useRef(selectionKey);
  useEffect(() => {
    if (shownKey.current === selectionKey) return;
    shownKey.current = selectionKey;
    if (settingsRef.current) settingsRef.current.scrollTop = 0;
    restoreSettingsFocus();
  }, [selectionKey, restoreSettingsFocus]);

  const chunks = useCallback(() => pageChunks(currentPage), [currentPage]);
  const settled = useSettleGate({
    pane: canvasRef,
    key: `${currentPage.id}:${isPreviewMode ? "preview" : "edit"}`,
    ready: !isLoading && !reach.loading,
    chunks,
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
            outline.hidden ? undefined : (
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
            isPreviewMode ? undefined : (
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
          <MainPaneHeader />
          <div
            ref={canvasRef}
            role="region"
            aria-label={isPreviewMode ? "Preview" : "Form canvas"}
            className={cn(
              PANE_SCROLL,
              "relative",
              !isPreviewMode && "p-4 pb-16",
            )}
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
                {isPreviewMode ? <PreviewBody /> : parts.canvas}
              </Settling>
            )}
          </div>
        </Workspace>
      )}
    </FormBuilderCanvas>
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
