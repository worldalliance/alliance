/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  collectUnresolvedVariableReferences,
  type UnresolvedVariableReference,
} from "@alliance/common/forms/variable-interpolation";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ensurePages, ensureSchemaViews } from "../lib/ensureFormSchema";
import {
  collectFormIssues,
  indexIssues,
  type FormIssue,
} from "../lib/formIssues";
import { JsonScopeKind, type JsonScope } from "../lib/formJson";
import { useDisplayBlockWrite } from "../lib/useDisplayBlockWrite";
import { useFormDraft } from "../lib/useFormDraft";
import { useFormSave, type DisplayOnlySave } from "../lib/useFormSave";
import { useFormulaSourceForms } from "../lib/useFormulaSourceForms";
import { useInputSources } from "../lib/useInputSources";
import { useSavedForm } from "../lib/useSavedForm";
import { type VisibilityGroups } from "../lib/visibilityGroups";
import { AggregateBuilder } from "./AggregateBuilder";
import ConfirmDialog from "./ConfirmDialog";
import { DisplayOnlyPreview } from "./DisplayOnlyPreview";
import { elementTarget } from "./form-canvas/canvasSelection";
import { PreviewBoundary } from "./form-canvas/ElementBoundary";
import { IssueGate, openIssue } from "./form-canvas/IssueList";
import { useCanvasEdits } from "./form-canvas/useCanvasEdits";
import { useCanvasSelection } from "./form-canvas/useCanvasSelection";
import { useOverrideTarget } from "./form-canvas/useOverrideTarget";
import { FormBuilderCanvas } from "./FormBuilderCanvas";
import {
  FormBuilderBanners,
  FormBuilderHeader,
  type FormEditorTab,
  type IssueListState,
} from "./FormBuilderHeader";
import { FormBuilderPreview } from "./FormBuilderPreview";
import { FormConflictModal } from "./FormConflictModal";
import { FormDraftContexts } from "./FormDraftContexts";
import { FormJsonModal } from "./FormJsonModal";
import { formFieldsErrorReason } from "./FormPickerError";
import { FormulaSourcesProvider } from "./FormulaSourcesContext";
import { FormVariablesProvider } from "./FormVariablesContext";
import { OutputBuilder } from "./OutputBuilder";
import { ShareableTextBuilder } from "./ShareableTextBuilder";
import { VariableBuilder } from "./VariableBuilder";

function describeUnresolvedReferences(
  references: UnresolvedVariableReference[],
): string {
  const lines = references.map(
    ({ name, locations }) => `#{${name}} — in ${locations.join(", ")}`,
  );
  return [
    "These references don't match any variable on this form, so respondents will see them exactly as written:",
    "",
    ...lines,
    "",
    "Save anyway?",
  ].join("\n");
}

// The two editors save through entirely different paths, so the props each one
// needs are spelled as a union rather than as independent optionals: a
// display-only builder with no `onSave` would otherwise typecheck and then save
// a general update's content as a new `Form`.
type FormBuilderProps = {
  initialSchema?: FormSchema;
  setFormId: (formId: number) => void;
} & (
  | {
      displayOnly: true;
      onSave: DisplayOnlySave;
      initialSnapshotId: number;
      title: string;
      formId?: undefined;
      actionName?: undefined;
    }
  | {
      displayOnly?: false;
      onSave?: undefined;
      initialSnapshotId?: undefined;
      title?: undefined;
      formId?: number;
      actionName?: string;
    }
);

const NO_VISIBILITY_GROUPS: VisibilityGroups = new Map();

const REGROUPS_ON_JSON_APPLY: Record<JsonScopeKind, boolean> = {
  [JsonScopeKind.Form]: true,
  [JsonScopeKind.Page]: false,
  [JsonScopeKind.Element]: false,
};

export function FormBuilder(props: FormBuilderProps) {
  const { initialSchema, setFormId } = props;
  // Destructuring the union would drop the correlation between these, so they
  // are pulled off `props` while it is still narrowable.
  const displayOnly = props.displayOnly ?? false;
  const displayOnlySave = props.displayOnly ? props.onSave : null;
  const initialSnapshotId = props.displayOnly ? props.initialSnapshotId : null;
  const displayOnlyTitle = props.displayOnly ? props.title : "";
  const formId = props.displayOnly ? undefined : props.formId;
  const actionName = props.displayOnly ? undefined : props.actionName;

  const newFormTitle = actionName ? actionName + " form" : "Untitled Form";

  const buildInitialSchema = () =>
    initialSchema
      ? ensurePages(initialSchema)
      : {
          description: "",
          pages: [
            {
              id: "page-1",
              title: "Page 1",
              fields: [],
            },
          ],
          submit: { label: "Complete" },
          outputViews: [],
          aggregateViews: [],
        };

  const formDraft = useFormDraft(buildInitialSchema);
  const {
    schema,
    groups: visibilityGroups,
    setSchema,
    regroupSchema,
    loadSchema,
    setGroups,
    validatorDrafts,
    setValidatorDraft,
    removeValidatorDraft,
    expressions,
    setExpression,
  } = formDraft;
  const canvasGroups = displayOnly ? NO_VISIBILITY_GROUPS : visibilityGroups;
  const canvas = useCanvasSelection({
    pages: schema.pages,
    groups: canvasGroups,
  });
  const {
    schemaLoads,
    reloadEditors,
    selectPlace,
    selectedPageIndex,
    keepPage,
    setSelection,
    selectionKey,
    selectFromOutline,
  } = canvas;
  const saved = useSavedForm({
    displayOnly,
    formId,
    initialSchema,
    initialSnapshotId,
    buildInitialSchema,
    schema,
    loadSchema,
    reloadEditors,
    selectPlace,
  });
  const { hasUnsavedChanges, conflict, isLoading, loadError, retryLoad } =
    saved;
  const [confirmUnresolvedVariables, setConfirmUnresolvedVariables] =
    useState(false);

  const {
    sourceForms,
    statusByForm: sourceFormStatus,
    retryFailed: retrySourceForms,
  } = useFormulaSourceForms(conflict ? [schema, conflict.theirs] : [schema]);
  const sourceStatuses = Object.entries(sourceFormStatus);
  const pendingSourceForms = useMemo(
    () =>
      new Set(
        Object.entries(sourceFormStatus)
          .filter(([, status]) => status === FormFieldsStatus.Pending)
          .map(([id]) => Number(id)),
      ),
    [sourceFormStatus],
  );
  const failedSourceForms = sourceStatuses.filter(
    ([, status]) => formFieldsErrorReason(status) !== null,
  ).length;
  const sourceFormsLoading = pendingSourceForms.size > 0;
  const sourceFormsFailed = failedSourceForms > 0;
  const validation = useMemo(
    () => ({ formId, sourceForms, pendingSourceForms }),
    [formId, sourceForms, pendingSourceForms],
  );
  const formulaSources = useInputSources({ formId, schema });

  const [searchParams, setSearchParams] = useSearchParams();

  const activeEditor = displayOnly
    ? "form"
    : (searchParams.get("editor") ?? "form");

  const setActiveEditor = useCallback(
    (editor: FormEditorTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("editor", editor);
        return next;
      });
    },
    [setSearchParams],
  );

  const [issueList, setIssueList] = useState<IssueListState>(null);
  const {
    saveForm,
    isSaving,
    saveError,
    closeConflict,
    handleKeepMine,
    handleTakeTheirs,
    handleMerge,
    handleCopyMine,
  } = useFormSave({
    displayOnlySave,
    formId,
    newFormTitle,
    setFormId,
    formDraft,
    saved,
    sourceFormsLoading,
    validation,
    reloadEditors,
    onInvalid: useCallback(() => setIssueList({ gate: IssueGate.Save }), []),
  });
  const [outputViewId, setOutputViewId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string>("preview");
  const [jsonScope, setJsonScope] = useState<JsonScope | null>(null);
  const draftValidatorIdRef = useRef(-1);
  const createDraftId = useCallback(() => {
    const nextId = draftValidatorIdRef.current;
    draftValidatorIdRef.current -= 1;
    return nextId;
  }, []);
  const customValidatorDraftContext = useMemo(
    () => ({
      drafts: validatorDrafts,
      setDraft: setValidatorDraft,
      removeDraft: removeValidatorDraft,
      createDraftId,
    }),
    [createDraftId, removeValidatorDraft, setValidatorDraft, validatorDrafts],
  );
  const expressionBuffers = useMemo(
    () => ({ buffers: expressions, setBuffer: setExpression }),
    [expressions, setExpression],
  );
  const builderRef = useRef<HTMLDivElement | null>(null);

  const { target: overrideTarget, override } = useOverrideTarget(selectionKey);

  const updateSchema = (newSchema: FormSchema, groups?: VisibilityGroups) => {
    setSchema(ensureSchemaViews(newSchema), groups);
  };

  const updateBlockById = useDisplayBlockWrite(schema, updateSchema);
  const edits = useCanvasEdits({
    schema,
    visibilityGroups,
    canvasGroups,
    updateSchema,
    canvas,
  });
  const { closeInsertion, deletionDialog } = edits;

  useEffect(() => {
    if (activeEditor !== "form" && isPreviewMode) {
      setIsPreviewMode(false);
    }
  }, [activeEditor, isPreviewMode]);

  const applyJson = (next: FormSchema) => {
    if (jsonScope && REGROUPS_ON_JSON_APPLY[jsonScope.kind]) {
      regroupSchema(ensureSchemaViews(next));
    } else {
      updateSchema(next);
    }
    if (jsonScope?.kind === JsonScopeKind.Element) {
      const page = next.pages[jsonScope.pageIndex];
      const element = page?.fields[jsonScope.index];
      if (page && element) {
        setSelection({
          pageId: page.id,
          target: elementTarget(element, jsonScope.index),
        });
      }
    }
    reloadEditors();
    setJsonScope(null);
  };

  // A dangling `#{name}` renders as written rather than breaking the form, so
  // it is worth a confirmation but not a refusal — an admin renaming a variable
  // would otherwise be unable to save until every reference was updated.
  const unresolvedVariableReferences = useMemo(
    () => collectUnresolvedVariableReferences(schema),
    [schema],
  );

  const issues = useMemo(
    () =>
      collectFormIssues({
        // As Save will write it, naming sub-fields a list input lacks.
        schema: syncSchemaListInputs(schema, sourceForms),
        groups: canvasGroups,
        expressions,
        validation,
      }),
    [canvasGroups, expressions, schema, sourceForms, validation],
  );
  const issueIndex = useMemo(() => indexIssues(issues), [issues]);
  const loadFailure =
    loadError === null
      ? null
      : {
          message: loadError,
          retryLabel: hasUnsavedChanges ? "Discard edits and retry" : "Retry",
          onRetry: retryLoad,
        };

  const handleSaveForm = useCallback(() => {
    if (loadError !== null || (issues.length > 0 && !sourceFormsLoading)) {
      setIssueList({ gate: IssueGate.Save });
      return;
    }
    if (unresolvedVariableReferences.length > 0) {
      setConfirmUnresolvedVariables(true);
      return;
    }
    void saveForm();
  }, [
    issues.length,
    loadError,
    saveForm,
    sourceFormsLoading,
    unresolvedVariableReferences,
  ]);

  const historyLocked =
    isSaving || isLoading || isPreviewMode || conflict !== null;
  const canUndo = formDraft.canUndo && !historyLocked;
  const canRedo = formDraft.canRedo && !historyLocked;
  const { undo: undoDraft, redo: redoDraft } = formDraft;
  const travel = useCallback(
    (move: () => void) => {
      keepPage(move);
      reloadEditors();
      closeInsertion();
    },
    [closeInsertion, keepPage, reloadEditors],
  );
  const undo = useCallback(() => travel(undoDraft), [travel, undoDraft]);
  const redo = useCallback(() => travel(redoDraft), [travel, redoDraft]);

  const goToIssue = (issue: FormIssue) =>
    openIssue(issue, {
      pages: schema.pages,
      select: (pageIndex, target, section) => {
        if (activeEditor !== "form") setActiveEditor("form");
        setIsPreviewMode(false);
        selectFromOutline({
          page: schema.pages[pageIndex]!,
          pageIndex,
          target,
          section,
        });
      },
      showOutputView: (viewId) => {
        setOutputViewId(viewId);
        setActiveEditor("outputs");
      },
      showVariables: () => setActiveEditor("variables"),
    });

  return (
    <FormDraftContexts
      validatorDrafts={customValidatorDraftContext}
      expressionBuffers={expressionBuffers}
      derivedWrite={formDraft.withoutStep}
    >
      {conflict && (
        <FormConflictModal
          base={conflict.base}
          mine={conflict.mine}
          theirs={conflict.theirs}
          validation={validation}
          sourceFormsLoading={sourceFormsLoading}
          sourceFormsFailed={sourceFormsFailed}
          saving={isSaving}
          onMerge={handleMerge}
          onKeepMine={handleKeepMine}
          onTakeTheirs={handleTakeTheirs}
          onCopyMine={handleCopyMine}
          onCancel={closeConflict}
        />
      )}
      <ConfirmDialog
        isOpen={confirmUnresolvedVariables}
        title="Save with unmatched variable references?"
        message={describeUnresolvedReferences(unresolvedVariableReferences)}
        isLoading={isSaving}
        onCancel={() => setConfirmUnresolvedVariables(false)}
        onConfirm={() => {
          setConfirmUnresolvedVariables(false);
          void saveForm();
        }}
      />
      {deletionDialog}
      {jsonScope && (
        <FormJsonModal
          scope={jsonScope}
          schema={schema}
          displayOnly={displayOnly}
          onApply={applyJson}
          onClose={() => setJsonScope(null)}
        />
      )}
      <FormVariablesProvider variables={schema.variables}>
        <FormulaSourcesProvider value={formulaSources}>
          <div
            ref={builderRef}
            className="flex h-[calc(100vh-40px)] bg-zinc-50"
          >
            <div className="flex-1 flex flex-col min-w-0">
              <FormBuilderHeader
                schema={schema}
                issues={issues}
                onGoToIssue={goToIssue}
                sources={{
                  pending: pendingSourceForms.size,
                  failed: failedSourceForms,
                  onRetry: retrySourceForms,
                }}
                loadFailure={loadFailure}
                issueList={issueList}
                onIssueListChange={setIssueList}
                history={{
                  scope: builderRef,
                  canUndo,
                  canRedo,
                  onUndo: undo,
                  onRedo: redo,
                }}
                onEditJson={() => setJsonScope({ kind: JsonScopeKind.Form })}
                isPreviewMode={isPreviewMode}
                onPreviewModeChange={setIsPreviewMode}
                activeEditor={activeEditor}
                onActiveEditorChange={displayOnly ? null : setActiveEditor}
                save={{
                  onSave: handleSaveForm,
                  isSaving,
                  isLoading,
                  hasUnsavedChanges,
                }}
              />
              <FormBuilderBanners
                isLoading={isLoading}
                loadFailure={loadFailure}
                saveError={saveError}
              />

              <div
                className={cn(
                  "flex-1 min-h-0",
                  activeEditor === "form" && !isPreviewMode
                    ? "flex"
                    : "p-6 overflow-y-auto",
                )}
              >
                {activeEditor === "shareable" ? (
                  <ShareableTextBuilder
                    schema={schema}
                    onSchemaChange={updateSchema}
                  />
                ) : activeEditor === "outputs" ? (
                  <OutputBuilder
                    schema={schema}
                    onSchemaChange={updateSchema}
                    onUpdateBlockById={updateBlockById}
                    editorsKey={schemaLoads}
                    selectedViewId={outputViewId}
                    onSelectView={setOutputViewId}
                  />
                ) : activeEditor === "aggregates" ? (
                  <AggregateBuilder
                    schema={schema}
                    onSchemaChange={updateSchema}
                  />
                ) : activeEditor === "variables" ? (
                  <VariableBuilder
                    key={schemaLoads}
                    schema={schema}
                    onSchemaChange={updateSchema}
                  />
                ) : isPreviewMode && displayOnly ? (
                  <div className="max-w-3xl mx-auto p-6">
                    <PreviewBoundary resetKeys={[schema]}>
                      <DisplayOnlyPreview
                        schema={schema}
                        title={displayOnlyTitle}
                      />
                    </PreviewBoundary>
                  </div>
                ) : isPreviewMode ? (
                  <FormBuilderPreview
                    schema={schema}
                    pageIndex={selectedPageIndex}
                    previewUserId={previewUserId}
                    setPreviewUserId={setPreviewUserId}
                  />
                ) : (
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
                  />
                )}
              </div>
            </div>
          </div>
        </FormulaSourcesProvider>
      </FormVariablesProvider>
    </FormDraftContexts>
  );
}
