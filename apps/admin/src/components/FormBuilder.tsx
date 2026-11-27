import { BuilderContext } from "../pages/forms/builder/BuilderContext";
import { useBuilderShortcuts } from "../pages/forms/builder/builderShortcuts";
import { BuilderWorkspace } from "../pages/forms/builder/BuilderWorkspace";
import {
  FormEditor,
  useFormBuilder,
  type FormBuilderProps,
} from "../pages/forms/builder/useFormBuilder";
import { FormConflictModal } from "./FormConflictModal";
import { FormDraftContexts } from "./FormDraftContexts";
import { FormJsonModal } from "./FormJsonModal";
import { FormulaSourcesProvider } from "./FormulaSourcesContext";
import { FormVariablesProvider } from "./FormVariablesContext";

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
    props: { displayOnly },
  } = builder;
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
