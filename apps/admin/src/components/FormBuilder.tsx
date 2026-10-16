/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  PlaceKind,
  type ConditionHolder,
} from "@alliance/common/forms/form-conditions";
import {
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import {
  collectUnresolvedVariableReferences,
  type UnresolvedVariableReference,
} from "@alliance/common/forms/variable-interpolation";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { conditionSourceFields } from "../lib/conditionSourceFields";
import { copyElementWithUniqueIds } from "../lib/copyWithUniqueIds";
import { addressedWrite } from "../lib/displayBlockById";
import { ensurePages, ensureSchemaViews } from "../lib/ensureFormSchema";
import {
  collectFormIssues,
  indexIssues,
  type FormIssue,
} from "../lib/formIssues";
import { JsonScopeKind, type JsonScope } from "../lib/formJson";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { useDisplayBlockWrite } from "../lib/useDisplayBlockWrite";
import { DropPosition } from "../lib/useDragReorder";
import { useFormDraft } from "../lib/useFormDraft";
import { useFormSave, type DisplayOnlySave } from "../lib/useFormSave";
import { useFormulaSourceForms } from "../lib/useFormulaSourceForms";
import { useInputSources } from "../lib/useInputSources";
import { useSavedForm } from "../lib/useSavedForm";
import {
  NeighborDirection,
  stepPast,
  type VisibilityGroups,
} from "../lib/visibilityGroups";
import { summarizeVisibility } from "../lib/visibilitySummary";
import { AggregateBuilder } from "./AggregateBuilder";
import ConfirmDialog from "./ConfirmDialog";
import { PerViewerOptions } from "./display-blocks";
import { renderBlockEditor } from "./display-blocks/blockEditors";
import { OverrideTargetContext } from "./display-blocks/perUserContent";
import { DisplayOnlyPreview } from "./DisplayOnlyPreview";
import {
  CanvasTargetKind,
  ChildKind,
  childPlace,
  elementTarget,
} from "./form-canvas/canvasSelection";
import { CanvasWorkspace } from "./form-canvas/CanvasWorkspace";
import { SelectChildProvider } from "./form-canvas/ChildRows";
import { ChildSettings } from "./form-canvas/ChildSettings";
import { DependencyLinks } from "./form-canvas/DependencyLinks";
import {
  ElementBoundary,
  FlaggedSettings,
  PreviewBoundary,
} from "./form-canvas/ElementBoundary";
import { ElementSettings } from "./form-canvas/ElementSettings";
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
import {
  IssueGate,
  openIssue,
  selectionIssues,
  SidebarIssues,
} from "./form-canvas/IssueList";
import { PageSettings, PageSettingsSidebar } from "./form-canvas/PageSettings";
import { RangeSettings } from "./form-canvas/RangeSettings";
import { SettingsSidebar } from "./form-canvas/SettingsSidebar";
import { SidebarSection } from "./form-canvas/sidebarSections";
import { useCanvasEdits } from "./form-canvas/useCanvasEdits";
import {
  SECTION_ON_SELECT,
  useCanvasSelection,
} from "./form-canvas/useCanvasSelection";
import { useOverrideTarget } from "./form-canvas/useOverrideTarget";
import { VisibilityGroupSettings } from "./form-canvas/VisibilityGroupSettings";
import {
  ElementExpressionScope,
  expressionKeys,
} from "./form-fields/conditions/expressionBuffers";
import { renderFieldEditor } from "./form-fields/fieldEditors";
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
import {
  VisibilityGroupContext,
  visibilityGroupMember,
} from "./VisibilityGroupContext";

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

const GROUP_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];
const RANGE_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];

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

  const availableElements = displayOnly
    ? DISPLAY_ONLY_ELEMENTS
    : AVAILABLE_ELEMENTS;

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
    focused,
    revealPending,
    revealed,
    select,
    selectFromOutline,
    extendTo,
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
  const {
    insertion,
    setInsertion,
    closeInsertion,
    guardDeletion,
    deletionDialog,
    insertAndSelect,
    pickElement,
    updateCurrentPage,
    addPage,
    movePage,
    copyPage,
    removePage,
    deleteElement,
    moveElement,
    duplicateElement,
    applyGrouped,
    updateElementAt,
    selectChildOf,
  } = useCanvasEdits({
    schema,
    visibilityGroups,
    canvasGroups,
    updateSchema,
    canvas,
  });

  useEffect(() => {
    if (activeEditor !== "form" && isPreviewMode) {
      setIsPreviewMode(false);
    }
  }, [activeEditor, isPreviewMode]);

  // Fields a page-level visibility condition can reference: anything answered
  // before this page can show, i.e. fields on earlier pages.
  const pagePreviousFields = useMemo(
    () =>
      schema.pages
        .slice(0, selectedPageIndex)
        .flatMap((page) => page.fields)
        .filter(isQuestionField),
    [schema.pages, selectedPageIndex],
  );

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

  const renderElementEditor = (index: number) => {
    const field = currentPage.fields[index];
    if (!field) return null;
    const updateField = updateElementAt(index);

    const { previousFields, laterFields } = conditionSourceFields({
      pages: schema.pages,
      pageIndex: selectedPageIndex,
      index,
    });
    const commonProps = {
      onUpdate: updateField,
      updateCurrent: addressedWrite(field, updateBlockById),
      onRemove: () => deleteElement(index),
      previousFields,
      laterFields,
    };
    return (
      <ElementExpressionScope
        parent={expressionKeys.pageElements(currentPage.id)}
        id={field.id}
      >
        <VisibilityGroupContext.Provider
          value={
            displayOnly
              ? null
              : visibilityGroupMember({
                  element: field,
                  groups: visibilityGroups,
                  setGroups,
                  summarize,
                  onOpenGroup: (key) =>
                    select(
                      { kind: CanvasTargetKind.Group, key },
                      SidebarSection.Conditions,
                    ),
                })
          }
        >
          <PerViewerOptions allowed={!displayOnly}>
            <SelectChildProvider value={selectChildOf(index)}>
              {isQuestionField(field)
                ? renderFieldEditor({ field, ...commonProps })
                : renderBlockEditor({ block: field, ...commonProps })}
            </SelectChildProvider>
          </PerViewerOptions>
        </VisibilityGroupContext.Provider>
      </ElementExpressionScope>
    );
  };

  const conditionFieldOf = useConditionFieldLookup(schema, currentPage);
  const summarize = (formula: VisibleIfFormula) =>
    summarizeVisibility(formula, conditionFieldOf);

  const renderDependencies = (
    item: ConditionHolder["formulas"],
    questionId: string | null,
  ) =>
    !displayOnly && (
      <DependencyLinks
        pages={schema.pages}
        groups={canvasGroups}
        item={item}
        questionId={questionId}
        fieldOf={conditionFieldOf}
        onSelect={(pageIndex, target) =>
          selectFromOutline({
            page: schema.pages[pageIndex]!,
            pageIndex,
            target,
            section: SidebarSection.Conditions,
          })
        }
      />
    );

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

  const renderSettings = () => {
    switch (resolvedTarget.kind) {
      case CanvasTargetKind.Page:
        return displayOnly ? (
          <p className="p-4 text-sm text-gray-500">
            Select a block on the canvas to edit it.
          </p>
        ) : (
          <PageSettingsSidebar
            pageId={currentPage.id}
            section={section}
            onSection={setSection}
            focusPending={focusPending}
            onFocused={focused}
            onMoveUp={
              selectedPageIndex > 0
                ? () =>
                    movePage({
                      from: selectedPageIndex,
                      dropIndex: selectedPageIndex - 1,
                      position: DropPosition.Before,
                    })
                : null
            }
            onMoveDown={
              selectedPageIndex < schema.pages.length - 1
                ? () =>
                    movePage({
                      from: selectedPageIndex,
                      dropIndex: selectedPageIndex + 1,
                      position: DropPosition.After,
                    })
                : null
            }
            onEditJson={() =>
              setJsonScope({
                kind: JsonScopeKind.Page,
                pageIndex: selectedPageIndex,
              })
            }
            onCopy={() => copyPage(selectedPageIndex)}
            onDelete={
              schema.pages.length > 1
                ? () =>
                    guardDeletion(
                      { kind: PlaceKind.Page, pageIndex: selectedPageIndex },
                      () => removePage(selectedPageIndex),
                    )
                : null
            }
            dependencies={renderDependencies(currentPage, null)}
          >
            <PageSettings
              key={`${currentPage.id}-${schemaLoads}`}
              page={currentPage}
              isFirstPage={selectedPageIndex === 0}
              previousFields={pagePreviousFields}
              onUpdate={updateCurrentPage}
            />
          </PageSettingsSidebar>
        );
      case CanvasTargetKind.Element: {
        const { index, child } = resolvedTarget;
        const element = currentPage.fields[index]!;
        if (child) {
          const sub =
            child.kind === ChildKind.SubField && element.kind === "list"
              ? element.fields[child.index]
              : undefined;
          return (
            <ElementExpressionScope
              parent={expressionKeys.pageElements(currentPage.id)}
              id={element.id}
            >
              <ChildSettings
                element={element}
                child={child}
                onUpdate={updateElementAt(index)}
                updateCurrent={addressedWrite(element, updateBlockById)}
                onReselect={(next) =>
                  setSelection({
                    pageId: currentPage.id,
                    target: { ...elementTarget(element, index), child: next },
                  })
                }
                onSelectParent={() =>
                  select(elementTarget(element, index), SidebarSection.Content)
                }
                section={section}
                onSection={setSection}
                focusPending={focusPending}
                onFocused={focused}
                editorKey={`${selectionKey}-${schemaLoads}`}
                dependencies={sub && renderDependencies(sub, sub.id)}
                guardDelete={(run) => {
                  const place = childPlace({
                    pageIndex: selectedPageIndex,
                    index,
                    child,
                  });
                  return place ? guardDeletion(place, run) : run();
                }}
              />
            </ElementExpressionScope>
          );
        }
        const stepTo = (direction: NeighborDirection) => {
          const step = stepPast({
            fields: currentPage.fields,
            groups: canvasGroups,
            index,
            direction,
          });
          return step && (() => moveElement({ from: index, ...step }));
        };
        return (
          <ElementSettings
            element={element}
            displayOnly={displayOnly}
            section={section}
            onSection={setSection}
            focusPending={focusPending}
            onFocused={focused}
            onMoveUp={stepTo(NeighborDirection.Previous)}
            onMoveDown={stepTo(NeighborDirection.Next)}
            onEditJson={() =>
              setJsonScope({
                kind: JsonScopeKind.Element,
                pageIndex: selectedPageIndex,
                index,
              })
            }
            onDuplicate={() => duplicateElement(index)}
            onDelete={() => deleteElement(index)}
            dependencies={renderDependencies(
              element,
              isQuestionField(element) ? element.id : null,
            )}
          >
            <div key={`${element.id || index}-${schemaLoads}`}>
              <OverrideTargetContext.Provider value={overrideTarget}>
                <ElementBoundary
                  element={element}
                  fallback={(message) => (
                    <FlaggedSettings
                      message={message}
                      repair="Edit its JSON, or delete it, under Advanced."
                    />
                  )}
                >
                  {() => renderElementEditor(index)}
                </ElementBoundary>
              </OverrideTargetContext.Provider>
            </div>
          </ElementSettings>
        );
      }
      case CanvasTargetKind.Group:
        return (
          <SettingsSidebar
            heading="Shared visibility"
            sections={GROUP_SECTIONS}
            section={section}
            onSection={setSection}
            focusPending={focusPending}
            onFocused={focused}
            dependencies={renderDependencies(
              {
                visibleIfFormula:
                  currentPage.fields[resolvedTarget.start]?.visibleIfFormula,
              },
              null,
            )}
          >
            <VisibilityGroupSettings
              key={`${resolvedTarget.key}-${schemaLoads}`}
              schema={schema}
              pageIndex={selectedPageIndex}
              groupKey={resolvedTarget.key}
              groups={visibilityGroups}
              setGroups={setGroups}
              applyGrouped={applyGrouped}
              summarize={summarize}
              onSelectMember={(memberIndex) =>
                select(
                  elementTarget(currentPage.fields[memberIndex]!, memberIndex),
                  SidebarSection.Content,
                )
              }
            />
          </SettingsSidebar>
        );
      case CanvasTargetKind.Range: {
        const { start, end } = resolvedTarget;
        return (
          <SettingsSidebar
            heading={`${withCount(end - start, "element")} selected`}
            sections={RANGE_SECTIONS}
            section={section}
            onSection={setSection}
            focusPending={focusPending}
            onFocused={focused}
          >
            <RangeSettings
              key={`${selectionKey}-${schemaLoads}`}
              schema={schema}
              pageIndex={selectedPageIndex}
              start={start}
              end={end}
              groups={visibilityGroups}
              applyGrouped={applyGrouped}
              summarize={summarize}
              onSelectGroup={(key) =>
                select(
                  { kind: CanvasTargetKind.Group, key },
                  SidebarSection.Conditions,
                )
              }
              onSelectMember={(index) =>
                select(
                  elementTarget(currentPage.fields[index]!, index),
                  SidebarSection.Content,
                )
              }
            />
          </SettingsSidebar>
        );
      }
      default:
        throw new Error(
          `unknown target: ${JSON.stringify(resolvedTarget satisfies never)}`,
        );
    }
  };

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
                        onMoveElement={(pageIndex, move) =>
                          moveElement(move, pageIndex)
                        }
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
                        onUpdateElement={(index, updates) =>
                          updateElementAt(index)(updates)
                        }
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
                        {renderSettings()}
                      </>
                    }
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
