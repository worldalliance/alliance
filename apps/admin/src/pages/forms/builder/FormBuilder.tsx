import { BuilderContext } from "./BuilderContext";
import { useBuilderShortcuts } from "./builderShortcuts";
import { BuilderWorkspace } from "./BuilderWorkspace";
import { FormConflictModal } from "./conflict/FormConflictModal";
import { FormulaSourcesProvider } from "./formulas/FormulaSourcesContext";
import { FormVariablesProvider } from "./formulas/FormVariablesContext";
import { FormJsonModal } from "./json/FormJsonModal";
import { FormDraftContexts } from "./selection/FormDraftContexts";
import { useEscapeUp } from "./selection/useEscapeUp";
import {
  FormEditor,
  useFormBuilder,
  type FormBuilderProps,
} from "./useFormBuilder";

export function FormBuilder(props: FormBuilderProps) {
  const builder = useFormBuilder(props);
  const {
    formDraft,
    schema,
    saved: { conflict },
    save,
    validation,
    sourceFormsLoading,
    sourceFormsFailed,
    saveGateDialog,
    edits: { deletionDialog },
    jsonScope,
    setJsonScope,
    applyJson,
    formulaSources,
    builderRef,
    requestSave,
    activeEditor,
    isPreviewMode,
    requestPreview,
    showEdit,
    canvas,
    props: { displayOnly },
  } = builder;
  useEscapeUp({
    root: builderRef,
    canvas,
    active: activeEditor === FormEditor.Form && !isPreviewMode,
  });
  useBuilderShortcuts({
    save: requestSave,
    togglePreview:
      activeEditor === FormEditor.Form
        ? isPreviewMode
          ? showEdit
          : requestPreview
        : null,
  });

  return (
    <BuilderContext.Provider value={builder}>
      <FormDraftContexts formDraft={formDraft}>
        {conflict && (
          <FormConflictModal
            base={conflict.base}
            mine={conflict.mine}
            theirs={conflict.theirs}
            validation={validation}
            sourceFormsLoading={sourceFormsLoading}
            sourceFormsFailed={sourceFormsFailed}
            saving={save.isSaving}
            onMerge={save.handleMerge}
            onKeepMine={save.handleKeepMine}
            onTakeTheirs={save.handleTakeTheirs}
            onCopyMine={save.handleCopyMine}
            onCancel={save.closeConflict}
            error={save.saveError}
          />
        )}
        {saveGateDialog}
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
            <div ref={builderRef} className="flex min-h-0 flex-1 flex-col">
              <BuilderWorkspace />
            </div>
          </FormulaSourcesProvider>
        </FormVariablesProvider>
      </FormDraftContexts>
    </BuilderContext.Provider>
  );
}
