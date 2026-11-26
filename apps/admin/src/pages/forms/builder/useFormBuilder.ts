import { emptyTaskFormSchema } from "@alliance/common/forms/empty-task-form-schema";
import { type FormSchema } from "@alliance/common/forms/form-schema";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { elementTarget } from "./selection/canvasSelection";
import {
  IssueGate,
  openIssue,
} from "./issues/IssueList";
import { useCanvasEdits } from "./selection/useCanvasEdits";
import { useCanvasSelection } from "./selection/useCanvasSelection";
import { useOverrideTarget } from "./selection/useOverrideTarget";
import { useSaveGate } from "./save/useSaveGate";
import { ensurePages, ensureSchemaViews } from "../../../lib/ensureFormSchema";
import { usePreviewAsOnLoad } from "../../../lib/formEditorLink";
import {
  collectFormIssues,
  indexIssues,
  type FormIssue,
} from "../../../lib/formIssues";
import { JsonScopeKind, type JsonScope } from "../../../lib/formJson";
import { useDisplayBlockWrite } from "../../../lib/useDisplayBlockWrite";
import { useFormDraft } from "../../../lib/useFormDraft";
import { useFormSave, type DisplayOnlySave } from "../../../lib/useFormSave";
import { useFormulaSourceValidation } from "../../../lib/useFormulaSourceForms";
import { useInputSources } from "../../../lib/useInputSources";
import { useSavedForm } from "../../../lib/useSavedForm";
import { type VisibilityGroups } from "../../../lib/visibilityGroups";
import { SaveNotice, saveStatusOf } from "./saveStatusRules";
import { useFormReach, type FormTask } from "./useFormReach";
import { useOutlineHidden } from "./useOutlineHidden";

export enum FormEditor {
  Form = "form",
  Shareable = "shareable",
  Outputs = "outputs",
  Aggregates = "aggregates",
  Variables = "variables",
  Rows = "rows",
}

const EDITORS: ReadonlySet<string> = new Set(Object.values(FormEditor));
const isEditor = (value: string | null): value is FormEditor =>
  value !== null && EDITORS.has(value);

export type IssueListState = { gate: IssueGate | null } | null;

// A display-only builder and a form builder save through different paths, so
// their props are a union: one with no `onSave` would otherwise typecheck and
// then save a general update's content as a new `Form`.
export type FormBuilderProps = {
  initialSchema?: FormSchema;
  setFormId: (formId: number) => void;
  onUnsavedChangesChange?: (unsaved: boolean) => void;
} & (
  | {
      displayOnly: true;
      onSave: DisplayOnlySave;
      initialSnapshotId: number;
      title: string;
      formId?: undefined;
      actionName?: undefined;
      taskFlow?: undefined;
      task?: undefined;
    }
  | {
      displayOnly?: false;
      onSave?: undefined;
      initialSnapshotId?: undefined;
      title?: undefined;
      formId?: number;
      actionName?: string;
      /** The action's task form, which members fill in through the task flow. */
      taskFlow?: boolean;
      /** The task this form belongs to; without it the forms index says. */
      task?: FormTask;
    }
);

const NO_VISIBILITY_GROUPS: VisibilityGroups = new Map();

const REGROUPS_ON_JSON_APPLY: Record<JsonScopeKind, boolean> = {
  [JsonScopeKind.Form]: true,
  [JsonScopeKind.Page]: false,
  [JsonScopeKind.Element]: false,
};

/** Everything the builder's panes read and do, out of its markup. */
export function useFormBuilder(props: FormBuilderProps) {
  const { initialSchema, setFormId, onUnsavedChangesChange } = props;
  // Destructuring the union would drop the correlation between these, so they
  // are pulled off `props` while it is still narrowable.
  const displayOnly = props.displayOnly ?? false;
  const displayOnlySave = props.displayOnly ? props.onSave : null;
  const initialSnapshotId = props.displayOnly ? props.initialSnapshotId : null;
  const displayOnlyTitle = props.displayOnly ? props.title : "";
  const formId = props.displayOnly ? undefined : props.formId;
  const actionName = props.displayOnly ? undefined : props.actionName;
  const taskFlow = props.displayOnly ? false : (props.taskFlow ?? false);
  const task = props.displayOnly ? undefined : props.task;

  const newFormTitle = actionName ? actionName + " form" : "Untitled Form";

  const buildInitialSchema = () =>
    initialSchema ? ensurePages(initialSchema) : emptyTaskFormSchema();

  const formDraft = useFormDraft(buildInitialSchema);
  const {
    schema,
    groups: visibilityGroups,
    setSchema,
    regroupSchema,
    loadSchema,
    setGroups,
    expressions,
    moveElementExpressions,
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
    keepSelection,
    setSelection,
    selectionKey,
    selectFromOutline,
    showPage,
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
  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);
  const reach = useFormReach({ formId, task, displayOnly });

  const {
    sourceForms,
    pendingSourceForms,
    failedSourceForms,
    retrySourceForms,
    validation,
  } = useFormulaSourceValidation({
    formId,
    schemas: conflict ? [schema, conflict.theirs] : [schema],
  });
  const sourceFormsLoading = pendingSourceForms.size > 0;
  const sourceFormsFailed = failedSourceForms > 0;
  const formulaSources = useInputSources({ formId, schema });

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedEditor = searchParams.get("editor");
  const activeEditor =
    !displayOnly && isEditor(requestedEditor)
      ? requestedEditor
      : FormEditor.Form;
  const setActiveEditor = useCallback(
    (editor: FormEditor) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (editor === FormEditor.Form) next.delete("editor");
        else next.set("editor", editor);
        return next;
      });
    },
    [setSearchParams],
  );

  const [issueList, setIssueList] = useState<IssueListState>(null);
  const showSaveIssues = useCallback(
    () => setIssueList({ gate: IssueGate.Save }),
    [],
  );
  const save = useFormSave({
    displayOnlySave,
    formId,
    newFormTitle,
    setFormId,
    formDraft,
    saved,
    sourceFormsLoading,
    validation,
    reloadEditors,
    onInvalid: showSaveIssues,
  });
  const { saveForm, isSaving, saveError } = save;
  const [outputViewId, setOutputViewId] = useState<string | null>(null);
  const previewAsOnLoad = usePreviewAsOnLoad().current;
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string>(
    previewAsOnLoad ?? "preview",
  );
  const [jsonScope, setJsonScope] = useState<JsonScope | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const outline = useOutlineHidden();

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
    moveExpressions: moveElementExpressions,
    canvas,
  });
  const { closeInsertion } = edits;

  if (activeEditor !== FormEditor.Form && isPreviewMode) {
    setIsPreviewMode(false);
  }

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
          retryLabel: hasUnsavedChanges
            ? "Discard edits and try again"
            : "Try again",
          onRetry: retryLoad,
        };
  const blockingIssues = issues.length + (loadError === null ? 0 : 1);
  const requestPreview = useCallback(() => {
    if (blockingIssues > 0) setIssueList({ gate: IssueGate.Preview });
    else setIsPreviewMode(true);
  }, [blockingIssues]);
  const previewPending = useRef(previewAsOnLoad !== null);
  useEffect(() => {
    if (!previewPending.current || isLoading || sourceFormsLoading) return;
    previewPending.current = false;
    requestPreview();
  }, [isLoading, sourceFormsLoading, requestPreview]);

  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const editedSince = useRef(schema);
  if (editedSince.current !== schema) {
    editedSince.current = schema;
    if (notice !== null && notice !== SaveNotice.Saved) setNotice(null);
  }
  const wasSaving = useRef(false);
  useEffect(() => {
    if (
      wasSaving.current &&
      !isSaving &&
      saveError === null &&
      !hasUnsavedChanges
    ) {
      setNotice(SaveNotice.Saved);
    }
    wasSaving.current = isSaving;
  }, [isSaving, saveError, hasUnsavedChanges]);
  if (notice === SaveNotice.Saved && hasUnsavedChanges) setNotice(null);

  const savedSchema = useMemo(
    (): FormSchema => JSON.parse(saved.lastSavedSchemaJSON),
    [saved.lastSavedSchemaJSON],
  );
  const { handleSaveForm, dialog: saveGateDialog } = useSaveGate({
    schema,
    blocked: loadError !== null || (issues.length > 0 && !sourceFormsLoading),
    onBlocked: showSaveIssues,
    saveForm,
    isSaving,
    live: { reach, savedSchema },
  });
  const requestSave = () => {
    if (isLoading || isSaving) return;
    if (!hasUnsavedChanges) {
      setNotice(SaveNotice.NothingToSave);
      return;
    }
    setNotice(sourceFormsLoading ? SaveNotice.SourcesLoading : null);
    void handleSaveForm();
  };
  const saveStatus = saveStatusOf({
    hasUnsavedChanges,
    isSaving,
    saveError,
    notice,
  });

  const historyLocked =
    isSaving || isLoading || isPreviewMode || conflict !== null;
  const canUndo = formDraft.canUndo && !historyLocked;
  const canRedo = formDraft.canRedo && !historyLocked;
  const { undo: undoDraft, redo: redoDraft } = formDraft;
  const travel = (move: () => void) => {
    keepSelection(move);
    reloadEditors();
    closeInsertion();
  };
  const undo = () => travel(undoDraft);
  const redo = () => travel(redoDraft);

  const goToIssue = (issue: FormIssue) =>
    openIssue(issue, {
      pages: schema.pages,
      select: (pageIndex, target, section) => {
        if (activeEditor !== FormEditor.Form) setActiveEditor(FormEditor.Form);
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
        setActiveEditor(FormEditor.Outputs);
      },
      showVariables: () => setActiveEditor(FormEditor.Variables),
      showRows: () => setActiveEditor(FormEditor.Rows),
    });

  const goToPage = (pageIndex: number) => {
    const page = schema.pages[pageIndex];
    if (page) showPage(page, pageIndex);
  };

  return {
    props: {
      displayOnly,
      displayOnlyTitle,
      formId,
      taskFlow,
    },
    formDraft,
    schema,
    visibilityGroups,
    setGroups,
    canvasGroups,
    canvas,
    edits,
    saved,
    save,
    reach,
    sources: {
      pending: pendingSourceForms.size,
      failed: failedSourceForms,
      onRetry: retrySourceForms,
    },
    validation,
    sourceFormsLoading,
    sourceFormsFailed,
    formulaSources,
    activeEditor,
    setActiveEditor,
    issues,
    issueIndex,
    loadFailure,
    issueList,
    setIssueList,
    goToIssue,
    outputViewId,
    setOutputViewId,
    isPreviewMode,
    requestPreview,
    showEdit: () => setIsPreviewMode(false),
    previewUserId,
    setPreviewUserId,
    jsonScope,
    setJsonScope,
    applyJson,
    builderRef,
    outline,
    overrideTarget,
    override,
    updateSchema,
    updateBlockById,
    saveGateDialog,
    requestSave,
    saveStatus,
    history: { canUndo, canRedo, undo, redo },
    goToPage,
    schemaLoads,
    selectedPageIndex,
  };
}

export type FormBuilderState = ReturnType<typeof useFormBuilder>;
