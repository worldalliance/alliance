/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type DisplayBlock,
  type DisplayKind,
} from "@alliance/common/forms/display-blocks";
import {
  fieldHasOptions,
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
  type ListField,
  type ListSubField,
  type Page,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { validateFormSchema } from "@alliance/common/forms/form-schema-validate";
import {
  collectUnresolvedVariableReferences,
  type UnresolvedVariableReference,
} from "@alliance/common/forms/variable-interpolation";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import {
  type Condition,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { R, type Result } from "@alliance/common/result";
import {
  tasksCreateCustomValidatorAdmin,
  tasksCreateFormAdmin,
  tasksGetForm,
  tasksUpdateFormAdmin,
} from "@alliance/shared/client";
import { useInvalidateFormsAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import { cn } from "@alliance/shared/styles/util";
import { customComponentRegistry } from "@alliance/sharedweb/forms/components";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBeforeUnload, useBlocker, useSearchParams } from "react-router";
import { conditionSourceFields } from "../lib/conditionSourceFields";
import {
  customValidatorIds,
  mapCustomValidatorIds,
} from "../lib/customValidatorIds";
import { addressedWrite } from "../lib/displayBlockById";
import { formSchemaIds, JsonScopeKind, type JsonScope } from "../lib/formJson";
import { mergeFormSchemas } from "../lib/formSchemaMerge";
import {
  findSingleOptionValueChange,
  getUpdatedVisibilityFormula,
} from "../lib/optionValueRename";
import { reorderPages } from "../lib/reorderPages";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { useDisplayBlockWrite } from "../lib/useDisplayBlockWrite";
import { DropPosition, moveItem } from "../lib/useDragReorder";
import { useFormDraft, type CreatedValidator } from "../lib/useFormDraft";
import { useFormulaSourceForms } from "../lib/useFormulaSourceForms";
import { useInputSources } from "../lib/useInputSources";
import { useSelectedPage } from "../lib/useSelectedPage";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import {
  deriveVisibilityGroups,
  NeighborDirection,
  stepPast,
  type GroupedPages,
  type VisibilityGroups,
} from "../lib/visibilityGroups";
import { summarizeVisibility } from "../lib/visibilitySummary";
import { AggregateBuilder } from "./AggregateBuilder";
import ConfirmDialog from "./ConfirmDialog";
import { createDisplayBlock, PerViewerOptions } from "./display-blocks";
import { renderBlockEditor } from "./display-blocks/blockEditors";
import { DisplayOnlyPreview } from "./DisplayOnlyPreview";
import {
  CanvasTargetKind,
  elementTarget,
  followElement,
  forgetPositions,
  resolveTarget,
  targetKey,
  type CanvasSelection,
  type CanvasTarget,
  type ChildTarget,
} from "./form-canvas/canvasSelection";
import {
  CanvasWorkspace,
  DrawerKind,
  useWideCanvasLayout,
} from "./form-canvas/CanvasWorkspace";
import { SelectChildProvider } from "./form-canvas/ChildRows";
import { ChildSettings } from "./form-canvas/ChildSettings";
import { ElementSettings } from "./form-canvas/ElementSettings";
import { FormCanvas } from "./form-canvas/FormCanvas";
import { FormOutline } from "./form-canvas/FormOutline";
import {
  AVAILABLE_ELEMENTS,
  DISPLAY_ONLY_ELEMENTS,
  InsertMode,
  InsertPoint,
  sameInsertLoc,
  type AvailableElement,
  type InsertLoc,
} from "./form-canvas/InsertPoint";
import { PageSettings, PageSettingsSidebar } from "./form-canvas/PageSettings";
import { SettingsSidebar } from "./form-canvas/SettingsSidebar";
import { SidebarSection } from "./form-canvas/sidebarSections";
import type { ListMove } from "./form-canvas/useListDrag";
import { VisibilityGroupSettings } from "./form-canvas/VisibilityGroupSettings";
import { ElementExpressionScope } from "./form-fields/conditions/expressionBuffers";
import { isDraftValidatorId } from "./form-fields/customValidatorDrafts";
import { renderFieldEditor } from "./form-fields/fieldEditors";
import { FormConflictModal } from "./FormConflictModal";
import { FormDraftContexts } from "./FormDraftContexts";
import { FormJsonButton } from "./FormJsonButton";
import { FormJsonModal } from "./FormJsonModal";
import { formFieldsErrorReason } from "./FormPickerError";
import { FormulaSourcesProvider } from "./FormulaSourcesContext";
import { FormVariablesProvider } from "./FormVariablesContext";
import { HistoryControls } from "./HistoryControls";
import { OutputBuilder } from "./OutputBuilder";
import { PreviewAsUserBar } from "./PreviewAsUserBar";
import { ShareableTextBuilder } from "./ShareableTextBuilder";
import { VariableBuilder } from "./VariableBuilder";
import {
  VisibilityGroupContext,
  visibilityGroupRole,
} from "./VisibilityGroupContext";

type FormEditorTab =
  | "form"
  | "shareable"
  | "outputs"
  | "aggregates"
  | "variables";

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

export type DisplayOnlySaveConflict = {
  theirs: FormSchema;
  theirsSnapshotId: number;
};

export type DisplayOnlySaveResult = Result<
  { snapshotId: number },
  DisplayOnlySaveConflict
>;

export type DisplayOnlySave = (params: {
  schema: FormSchema;
  expectedSnapshotId: number | null;
}) => Promise<DisplayOnlySaveResult>;

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

const ensureSchemaViews = (schema: FormSchema): FormSchema => ({
  ...schema,
  outputViews: schema.outputViews ?? [],
  aggregateViews: schema.aggregateViews ?? [],
});

const ensurePages = (schema: FormSchema): FormSchema => {
  const withOutputViews = ensureSchemaViews(schema);
  if (
    !withOutputViews.pages ||
    !Array.isArray(withOutputViews.pages) ||
    withOutputViews.pages.length === 0
  ) {
    return {
      ...withOutputViews,
      pages: [{ id: "page-1", title: "Page 1", fields: [] }],
    };
  }
  return withOutputViews;
};

const applyOptionValueToConditionalVisibility = (
  fields: PageItem[],
  controllerId: string,
  previousValue: string,
  nextValue: string,
): PageItem[] => {
  let hasChanges = false;

  const nextFields = fields.map((candidate) => {
    const formulaResult = getUpdatedVisibilityFormula(
      candidate.visibleIfFormula,
      controllerId,
      previousValue,
      nextValue,
    );

    if (!formulaResult.changed) {
      return candidate;
    }

    hasChanges = true;
    return {
      ...candidate,
      ...(formulaResult.visibleIfFormula != null
        ? { visibleIfFormula: formulaResult.visibleIfFormula }
        : {}),
    };
  });

  return hasChanges ? nextFields : fields;
};

const createUniqueFormBuilderId = (
  prefix: "block" | "field" | "page",
  usedIds: Set<string>,
) => {
  let id = "";
  do {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
};

const collectSchemaIds = (schema: FormSchema) => new Set(formSchemaIds(schema));

const NO_VISIBILITY_GROUPS: VisibilityGroups = new Map();

const REGROUPS_ON_JSON_APPLY: Record<JsonScopeKind, boolean> = {
  [JsonScopeKind.Form]: true,
  [JsonScopeKind.Page]: false,
  [JsonScopeKind.Element]: false,
};

const remapConditionFieldReferences = (
  condition: Condition,
  idMap: ReadonlyMap<string, string>,
): Condition => {
  switch (condition.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "hasValue": {
      if (condition.sourceFormId != null) {
        return condition;
      }
      const nextWhen = idMap.get(condition.when);
      return nextWhen ? { ...condition, when: nextWhen } : condition;
    }
    case "validator":
    case "deviceType":
    case "outputBlockVisible":
    case "userHasCity":
    case "userPropertyHasValue":
    case "firstContractSigned":
    case "completedActionCount":
      return condition;
    default:
      condition satisfies never;
      return condition;
  }
};

const remapVisibleIfFormulaFieldReferences = (
  visibleIfFormula: VisibleIfFormula | undefined,
  idMap: ReadonlyMap<string, string>,
): VisibleIfFormula | undefined => {
  if (!visibleIfFormula?.conditions) {
    return visibleIfFormula;
  }

  let changed = false;
  const conditions: Record<string, Condition> = {};
  for (const [name, condition] of Object.entries(visibleIfFormula.conditions)) {
    const nextCondition = remapConditionFieldReferences(condition, idMap);
    conditions[name] = nextCondition;
    if (nextCondition !== condition) {
      changed = true;
    }
  }

  return changed ? { ...visibleIfFormula, conditions } : visibleIfFormula;
};

const remapListFieldReferences = (
  field: ListField,
  idMap: ReadonlyMap<string, string>,
): ListField => ({
  ...field,
  visibleIfFormula: remapVisibleIfFormulaFieldReferences(
    field.visibleIfFormula,
    idMap,
  ),
  requiredIfFormula: remapVisibleIfFormulaFieldReferences(
    field.requiredIfFormula,
    idMap,
  ),
  fields: field.fields.map((subField) => remapFieldReferences(subField, idMap)),
  outputViewHiddenFieldIds: field.outputViewHiddenFieldIds
    ?.map((id) => idMap.get(id) ?? id)
    .filter((id, index, ids) => ids.indexOf(id) === index),
  prefillFromPreviousAnswer: field.prefillFromPreviousAnswer
    ? {
        ...field.prefillFromPreviousAnswer,
        targetSubFieldId:
          idMap.get(field.prefillFromPreviousAnswer.targetSubFieldId) ??
          field.prefillFromPreviousAnswer.targetSubFieldId,
      }
    : undefined,
});

const remapFieldReferences = <T extends AnyField>(
  field: T,
  idMap: ReadonlyMap<string, string>,
): T => {
  if ("fields" in field) {
    return remapListFieldReferences(field, idMap) as T;
  }
  return {
    ...field,
    visibleIfFormula: remapVisibleIfFormulaFieldReferences(
      field.visibleIfFormula,
      idMap,
    ),
    requiredIfFormula: remapVisibleIfFormulaFieldReferences(
      field.requiredIfFormula,
      idMap,
    ),
  };
};

const copyNestedBlockIds = (
  block: DisplayBlock,
  usedIds: Set<string>,
): DisplayBlock =>
  block.kind === "accordion"
    ? {
        ...block,
        sections: block.sections.map((section) => ({
          ...section,
          id: createUniqueFormBuilderId("block", usedIds),
          blocks: section.blocks.map((nested) => ({
            ...nested,
            id: createUniqueFormBuilderId("block", usedIds),
          })),
        })),
      }
    : block;

const remapDisplayBlockReferences = (
  block: DisplayBlock,
  idMap: ReadonlyMap<string, string>,
): DisplayBlock => ({
  ...block,
  visibleIfFormula: remapVisibleIfFormulaFieldReferences(
    block.visibleIfFormula,
    idMap,
  ),
});

const remapCopiedPageReferences = (
  page: Page,
  idMap: ReadonlyMap<string, string>,
): Page => ({
  ...page,
  fields: page.fields.map((element) =>
    isQuestionField(element)
      ? remapFieldReferences(element, idMap)
      : remapDisplayBlockReferences(element, idMap),
  ),
});

const assignCopiedFieldIds = <T extends AnyField>(
  field: T,
  usedIds: Set<string>,
  idMap: Map<string, string>,
): T => {
  const nextId = createUniqueFormBuilderId("field", usedIds);
  idMap.set(field.id, nextId);

  if ("fields" in field) {
    return {
      ...field,
      id: nextId,
      fields: field.fields.map((subField) =>
        assignCopiedFieldIds(subField, usedIds, idMap),
      ) as ListSubField[],
    };
  }

  return { ...field, id: nextId };
};

const copyPageWithUniqueIds = (page: Page, schema: FormSchema): Page => {
  const usedIds = collectSchemaIds(schema);
  const idMap = new Map<string, string>();
  const copiedPage = structuredClone(page);
  const copyPageId = createUniqueFormBuilderId("page", usedIds);
  idMap.set(page.id, copyPageId);

  const assignCopiedElementIds = (elements: Page["fields"]): Page["fields"] =>
    elements.map((element) => {
      if (isQuestionField(element)) {
        return assignCopiedFieldIds(element, usedIds, idMap);
      }

      const nextId = createUniqueFormBuilderId("block", usedIds);
      if (element.id) {
        idMap.set(element.id, nextId);
      }
      return copyNestedBlockIds({ ...element, id: nextId }, usedIds);
    });

  const pageWithCopiedIds: Page = {
    ...copiedPage,
    id: copyPageId,
    title: copiedPage.title ? `${copiedPage.title} (Copy)` : "Copied page",
    fields: assignCopiedElementIds(copiedPage.fields),
  };

  return remapCopiedPageReferences(pageWithCopiedIds, idMap);
};

const copyElementWithUniqueIds = (
  element: PageItem,
  schema: FormSchema,
): PageItem => {
  const usedIds = collectSchemaIds(schema);
  const idMap = new Map<string, string>();
  const cloned = structuredClone(element);

  if (isQuestionField(cloned)) {
    // Only ids inside the copied field (itself + list sub-fields) are
    // remapped; references to other fields keep pointing at the originals.
    return remapFieldReferences(
      assignCopiedFieldIds(cloned, usedIds, idMap),
      idMap,
    );
  }

  return copyNestedBlockIds(
    { ...cloned, id: createUniqueFormBuilderId("block", usedIds) },
    usedIds,
  );
};

const GROUP_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];

const SECTION_ON_SELECT: Record<CanvasTargetKind, SidebarSection> = {
  [CanvasTargetKind.Page]: SidebarSection.Content,
  [CanvasTargetKind.Element]: SidebarSection.Content,
  [CanvasTargetKind.Group]: SidebarSection.Conditions,
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
    amendSchema,
    endStep,
    regroupSchema,
    loadSchema,
    setGroups,
    validatorDrafts,
    setValidatorDraft,
    removeValidatorDraft,
    resolveValidatorDrafts,
    expressions,
    setExpression,
  } = formDraft;
  const [lastSavedSchemaJSON, setLastSavedSchemaJSON] = useState<string>(() =>
    JSON.stringify(buildInitialSchema()),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [baseFormSnapshotId, setBaseFormSnapshotId] = useState<number | null>(
    initialSnapshotId,
  );
  const [conflict, setConflict] = useState<{
    base: FormSchema;
    mine: FormSchema;
    theirs: FormSchema;
    theirsSnapshotId: number;
  } | null>(null);
  // Editors that keep their own copy of a formula or its text only follow it
  // through their own edits, so a schema loaded from a conflict or from
  // pasted JSON, or restored by undo or redo, remounts them.
  const [schemaLoads, setSchemaLoads] = useState(0);
  const [confirmUnresolvedVariables, setConfirmUnresolvedVariables] =
    useState(false);

  const { sourceForms, statusByForm: sourceFormStatus } = useFormulaSourceForms(
    conflict ? [schema, conflict.theirs] : [schema],
  );
  const sourceFormsLoading = Object.values(sourceFormStatus).includes(
    FormFieldsStatus.Pending,
  );
  const sourceFormsFailed = Object.values(sourceFormStatus).some(
    (status) => formFieldsErrorReason(status) !== null,
  );
  const validation = useMemo(
    () => ({ formId, sourceForms }),
    [formId, sourceForms],
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

  const { selectedPageIndex, setSelectedPageIndex, keepPage } = useSelectedPage(
    schema.pages,
  );
  const [selection, setSelection] = useState<CanvasSelection>(() => ({
    pageId: schema.pages[0]?.id ?? "",
    target: { kind: CanvasTargetKind.Page },
  }));
  const [section, setSection] = useState(SidebarSection.Content);
  const reloadEditors = useCallback(() => {
    setSchemaLoads((count) => count + 1);
    setSelection((current) => {
      const target = forgetPositions(current.target);
      return target === current.target ? current : { ...current, target };
    });
  }, []);
  const wideCanvas = useWideCanvasLayout();
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [focusPending, setFocusPending] = useState(false);
  const focused = useCallback(() => setFocusPending(false), []);
  const [revealPending, setRevealPending] = useState(false);
  const revealed = useCallback(() => setRevealPending(false), []);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string>("preview");
  const previewUsersQuery = useUsersAdmin({ enabled: isPreviewMode });
  const previewUsers = useMemo(
    () => previewUsersQuery.data ?? [],
    [previewUsersQuery.data],
  );
  const isLoadingPreviewUsers = previewUsersQuery.isLoading;
  const previewUserError = previewUsersQuery.isLoadingError
    ? "Could not load users"
    : null;
  const [insertion, setInsertion] = useState<{
    loc: InsertLoc;
    mode: InsertMode;
  } | null>(null);
  const closeInsertion = useCallback(() => setInsertion(null), []);
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

  const currentPage = schema.pages[selectedPageIndex] ??
    schema.pages?.[0] ?? { id: "page-1", title: "Page 1", fields: [] };
  const canvasGroups = displayOnly ? NO_VISIBILITY_GROUPS : visibilityGroups;
  const resolvedTarget = resolveTarget({
    page: currentPage,
    groups: canvasGroups,
    selection,
  });

  const applyInsert = (item: PageItem, loc: InsertLoc) => {
    const { index, groupKey } = loc;
    const groupFormula =
      groupKey == null
        ? undefined
        : currentPage.fields[index - 1]?.visibleIfFormula;
    const inserted =
      groupFormula && item.id
        ? { ...item, visibleIfFormula: groupFormula }
        : item;
    const newFields = [...currentPage.fields];
    newFields.splice(index, 0, inserted);
    updateSchema(
      {
        ...schema,
        pages: schema.pages.map((page, idx) =>
          idx === selectedPageIndex ? { ...page, fields: newFields } : page,
        ),
      },
      groupKey != null && inserted.id
        ? new Map(visibilityGroups).set(inserted.id, groupKey)
        : undefined,
    );
  };
  const resolvedPreviewUser = useMemo(() => {
    if (previewUserId === "preview") {
      return FORM_BUILDER_PREVIEW_USER;
    }
    const match = previewUsers.find(
      (candidate) => String(candidate.id) === previewUserId,
    );
    return match ?? FORM_BUILDER_PREVIEW_USER;
  }, [previewUserId, previewUsers]);
  const resolvedPreviewUserId =
    previewUserId === "preview"
      ? "preview"
      : (resolvedPreviewUser?.id ?? "preview");

  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const invalidateForms = useInvalidateFormsAdmin();

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
  }: {
    page: Page;
    pageIndex: number;
    target: CanvasTarget;
  }) => {
    setSelectedPageIndex(pageIndex);
    setSelection({ pageId: page.id, target });
    setSection(SECTION_ON_SELECT[target.kind]);
    setRevealPending(true);
    setDrawer(wideCanvas ? null : DrawerKind.Settings);
  };

  const insertAndSelect = (item: PageItem, loc: InsertLoc) => {
    applyInsert(item, loc);
    setInsertion(null);
    select(elementTarget(item, loc.index), SidebarSection.Content);
    setFocusPending(true);
  };

  const pickElement = (element: AvailableElement, loc: InsertLoc) => {
    switch (element.type) {
      case "field":
        addField(element.id, loc);
        break;
      case "block":
        addDisplayBlock(element.kind, loc);
        break;
      case "copy":
        setInsertion({ loc, mode: InsertMode.Copy });
        break;
      default:
        throw new Error(
          `Unknown element type: ${(element satisfies never as AvailableElement).type}`,
        );
    }
  };

  // An insert position is relative to the current page, so it can't survive a
  // page switch.
  useEffect(() => {
    setInsertion(null);
  }, [selectedPageIndex]);

  // A new form's first save already holds the saved schema; refetching it
  // would regroup and drop the admin's manual group boundaries.
  const createdFormIdRef = useRef<number | null>(null);

  // Load form data when formId changes
  useEffect(() => {
    if (displayOnly || !formId || initialSchema) return;
    if (createdFormIdRef.current === formId) {
      createdFormIdRef.current = null;
      return;
    }
    setIsLoading(true);
    setLoadError(null);

    tasksGetForm({ path: { id: formId } })
      .then((response) => {
        if (response.data) {
          // Convert the form entity back to FormSchema
          const form = response.data as any;
          if (form.schema) {
            const nextSchema = ensurePages(
              form.schema as unknown as FormSchema,
            );
            loadSchema(nextSchema);
            setLastSavedSchemaJSON(JSON.stringify(nextSchema));
            setBaseFormSnapshotId(
              typeof form.formSnapshotId === "number"
                ? form.formSnapshotId
                : null,
            );
            setHasUnsavedChanges(false);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load form:", error);
        setLoadError(
          error instanceof Error ? error.message : "Failed to load form",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [displayOnly, formId, initialSchema, loadSchema]);

  const addField = (kind: FieldKind, loc: InsertLoc) => {
    const fieldId = `field-${Date.now()}`;
    let newField: AnyField;

    switch (kind) {
      case "text":
        newField = {
          id: fieldId,
          type: "input",
          kind: "text",
          label: "Text Field",
          required: false,
        };
        break;
      case "textarea":
        newField = {
          id: fieldId,
          type: "input",
          kind: "textarea",
          label: "Textarea Field",
          required: false,
          rows: 3,
        };
        break;
      case "email":
        newField = {
          id: fieldId,
          type: "input",
          kind: "email",
          label: "Email Field",
          required: false,
        };
        break;
      case "phone":
        newField = {
          id: fieldId,
          type: "input",
          kind: "phone",
          label: "Phone Field",
          required: false,
          placeholder: "Enter phone number",
          autoExtractUserData: false,
        };
        break;
      case "number":
        newField = {
          id: fieldId,
          type: "input",
          kind: "number",
          label: "Number Field",
          required: false,
        };
        break;
      case "range":
        newField = {
          id: fieldId,
          type: "input",
          kind: "range",
          label: "Range Field",
          required: false,
          optionCount: 10,
          startLabel: "",
          endLabel: "",
        };
        break;
      case "checkbox":
        newField = {
          id: fieldId,
          type: "input",
          kind: "checkbox",
          label: "Checkbox Field",
          required: false,
        };
        break;
      case "radio":
        newField = {
          id: fieldId,
          type: "input",
          kind: "radio",
          label: "Radio Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "select":
        newField = {
          id: fieldId,
          type: "input",
          kind: "select",
          label: "Select Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "multiselect":
        newField = {
          id: fieldId,
          type: "input",
          kind: "multiselect",
          label: "Multi-Select Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "date":
        newField = {
          id: fieldId,
          type: "input",
          kind: "date",
          label: "Date Field",
          required: false,
        };
        break;
      case "time":
        newField = {
          id: fieldId,
          type: "input",
          kind: "time",
          label: "Time Field",
          required: false,
          autoExtractUserData: false,
        };
        break;
      case "timezone":
        newField = {
          id: fieldId,
          type: "input",
          kind: "timezone",
          label: "Timezone Field",
          required: false,
          autoExtractUserData: false,
        };
        break;
      case "city":
        newField = {
          id: fieldId,
          type: "input",
          kind: "city",
          label: "City Field",
          required: false,
          placeholder: "Search for a city",
          minLength: 1,
          autoExtractUserData: false,
        };
        break;
      case "file":
        newField = {
          id: fieldId,
          type: "input",
          kind: "file",
          label: "File Field",
          required: false,
        };
        break;
      case "contract":
        newField = {
          id: fieldId,
          type: "input",
          kind: "contract",
          label: "Contract Field",
          required: false,
          contractId: null,
          signQuestion: "Sign the contract?",
          yesLabel: "Yes",
          noLabel: "No",
        };
        break;
      case "list":
        newField = {
          id: fieldId,
          type: "input",
          kind: "list",
          label: "List Field",
          fields: [],
          defaultNumber: 0,
          min: 0,
          required: false,
        };
        break;
      case "ranking":
        newField = {
          id: fieldId,
          type: "input",
          kind: "ranking",
          label: "Ranking Field",
          required: false,
          options: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
            { label: "Option 3", value: "option3" },
          ],
        };
        break;
      case "custom": {
        const defaultComponent = customComponentRegistry[0];
        newField = {
          id: fieldId,
          type: "input",
          kind: "custom",
          label: "Custom Component",
          required: false,
          componentId: defaultComponent?.id ?? "",
        } as AnyField;
        break;
      }
      default:
        kind satisfies never;
        return;
    }

    insertAndSelect(newField, loc);
  };

  const addDisplayBlock = (kind: DisplayKind, loc: InsertLoc) => {
    insertAndSelect(createDisplayBlock(kind, `block-${Date.now()}`), loc);
  };

  const updateSchema = (newSchema: FormSchema, groups?: VisibilityGroups) => {
    setSchema(ensureSchemaViews(newSchema), groups);
  };

  const updateBlockById = useDisplayBlockWrite(schema, updateSchema);

  const resolveCustomValidatorDrafts = useCallback(
    async (schemaToSave: FormSchema) => {
      const draftIds = [...customValidatorIds(schemaToSave)].filter(
        isDraftValidatorId,
      );

      const created = new Map<number, CreatedValidator>();
      if (draftIds.length === 0) {
        return { schema: schemaToSave, created };
      }

      await Promise.all(
        draftIds.map(async (draftId) => {
          const draft = validatorDrafts[draftId];
          if (!draft) {
            throw new Error("Missing custom validator draft configuration.");
          }
          const response = await tasksCreateCustomValidatorAdmin({
            body: {
              type: draft.type,
              idArgument: draft.idArgument,
              expression: draft.expression,
            },
          });
          if (!response.data) {
            throw new Error("createCustomValidator returned no data");
          }
          created.set(draftId, { id: response.data.id, draft });
        }),
      );

      const nextSchema = mapCustomValidatorIds(
        schemaToSave,
        (id) => created.get(id)?.id ?? id,
      );

      return { schema: nextSchema, created };
    },
    [validatorDrafts],
  );

  useEffect(() => {
    const currentSchemaJSON = JSON.stringify(schema);
    setHasUnsavedChanges(currentSchemaJSON !== lastSavedSchemaJSON);
  }, [schema, lastSavedSchemaJSON]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [hasUnsavedChanges],
    ),
  );

  /** Bypass blocker while save-driven `setFormId` navigation sees stale dirty state. */
  const skipNavigationBlockRef = useRef(false);
  const navigationBlocker = useBlocker(
    useCallback(
      () => hasUnsavedChanges && !skipNavigationBlockRef.current,
      [hasUnsavedChanges],
    ),
  );

  useEffect(() => {
    if (navigationBlocker.state === "blocked") {
      const confirmExit = window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?",
      );

      if (confirmExit) {
        navigationBlocker.proceed?.();
      } else {
        navigationBlocker.reset?.();
      }
    }
  }, [navigationBlocker]);

  useEffect(() => {
    if (activeEditor !== "form" && isPreviewMode) {
      setIsPreviewMode(false);
    }
  }, [activeEditor, isPreviewMode]);

  const updateCurrentPage = (updates: Partial<Page>) => {
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, ...updates } : page,
      ),
    });
  };

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

  const addPage = () => {
    const pageNumber = schema.pages.length + 1;
    const newPage: Page = {
      id: createUniqueFormBuilderId("page", collectSchemaIds(schema)),
      title: `Page ${pageNumber}`,
      fields: [],
    };
    updateSchema({
      ...schema,
      pages: [...schema.pages, newPage],
    });
    selectFromOutline({
      page: newPage,
      pageIndex: schema.pages.length,
      target: { kind: CanvasTargetKind.Page },
    });
    setFocusPending(true);
  };

  const movePage = ({ from, dropIndex, position }: ListMove) => {
    const moved = reorderPages({
      pages: schema.pages,
      draggedIndex: from,
      dropIndex,
      position,
      selectedIndex: selectedPageIndex,
    });
    if (moved) {
      updateSchema({ ...schema, pages: moved.pages });
      setSelectedPageIndex(moved.selectedIndex);
    }
  };

  const copyPage = (pageIndex: number) => {
    const sourcePage = schema.pages[pageIndex];
    if (!sourcePage) return;

    const copiedPage = copyPageWithUniqueIds(sourcePage, schema);
    const nextPages = [...schema.pages];
    const copiedPageIndex = pageIndex + 1;
    nextPages.splice(copiedPageIndex, 0, copiedPage);

    updateSchema(
      { ...schema, pages: nextPages },
      new Map([...visibilityGroups, ...deriveVisibilityGroups([copiedPage])]),
    );
    showPage(copiedPage, copiedPageIndex);
  };

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

  const removePage = (pageIndex: number) => {
    if (schema.pages.length <= 1) return;
    updateSchema({
      ...schema,
      pages: schema.pages.filter((_, i) => i !== pageIndex),
    });
  };

  const saveForm = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (sourceFormsLoading) {
        showErrorToast(
          "Still loading the questions of forms your formulas read. Try again in a moment.",
        );
        return;
      }

      // List inputs name sub-fields added since they were last saved, from
      // labels that are final by now.
      const syncedSchema = syncSchemaListInputs(schema, sourceForms);
      amendSchema(syncedSchema);
      endStep();

      const validationErrors = validateFormSchema(syncedSchema, validation);
      if (validationErrors.length > 0) {
        const summary = validationErrors
          .map((e) => `• Block ${e.blockId}: ${e.message}`)
          .join("\n");
        setSaveError(summary);
        showErrorToast("Fix invalid references before saving");
        return;
      }

      const { schema: schemaForSave, created } =
        await resolveCustomValidatorDrafts(syncedSchema);
      if (created.size > 0) {
        resolveValidatorDrafts(created);
      }

      if (displayOnlySave) {
        const result = await displayOnlySave({
          schema: schemaForSave,
          expectedSnapshotId: baseFormSnapshotId,
        });
        if (R.isFailure(result)) {
          setConflict({
            base: JSON.parse(lastSavedSchemaJSON) as FormSchema,
            mine: schemaForSave,
            theirs: result.error.theirs,
            theirsSnapshotId: result.error.theirsSnapshotId,
          });
          showErrorToast("This update was changed by someone else");
          return;
        }
        setLastSavedSchemaJSON(JSON.stringify(schemaForSave));
        setBaseFormSnapshotId(result.value.snapshotId);
        setHasUnsavedChanges(false);
        showSuccessToast("Saved successfully");
        return;
      }

      let response;

      if (formId) {
        response = await tasksUpdateFormAdmin({
          path: { formId },
          body: {
            schema: schemaForSave as unknown as Record<string, unknown>,
            expectedFormSnapshotId: baseFormSnapshotId ?? undefined,
          },
        });
      } else {
        response = await tasksCreateFormAdmin({
          body: {
            title: newFormTitle,
            schema: schemaForSave as unknown as Record<string, unknown>,
          },
        });
      }

      if (formId && response.response.status === 409) {
        const latest = await tasksGetForm({ path: { id: formId } });
        const latestData = latest.data as
          | { schema?: unknown; formSnapshotId?: number }
          | undefined;
        if (
          latestData?.schema &&
          typeof latestData.formSnapshotId === "number"
        ) {
          setConflict({
            base: JSON.parse(lastSavedSchemaJSON) as FormSchema,
            mine: schemaForSave,
            theirs: ensurePages(latestData.schema as FormSchema),
            theirsSnapshotId: latestData.formSnapshotId,
          });
        } else {
          setSaveError(
            "This form was changed by someone else. Reload to continue.",
          );
        }
        showErrorToast("This form was changed by someone else");
        return;
      }

      if (response.response.ok && response.data) {
        void invalidateForms();
        setLastSavedSchemaJSON(JSON.stringify(schemaForSave));
        setBaseFormSnapshotId(response.data.formSnapshotId);
        setHasUnsavedChanges(false);
        skipNavigationBlockRef.current = true;
        if (response.data.id !== formId) {
          createdFormIdRef.current = response.data.id;
        }
        setFormId(response.data.id);
        skipNavigationBlockRef.current = false;
        showSuccessToast("Form saved successfully");
      } else {
        const fallbackMessage = "Could not save form";
        setSaveError(fallbackMessage);
        showErrorToast(fallbackMessage);
      }
    } catch (error) {
      console.error("Failed to save form:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save form";
      setSaveError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    displayOnlySave,
    formId,
    baseFormSnapshotId,
    invalidateForms,
    lastSavedSchemaJSON,
    newFormTitle,
    amendSchema,
    endStep,
    resolveCustomValidatorDrafts,
    resolveValidatorDrafts,
    schema,
    setFormId,
    showErrorToast,
    showSuccessToast,
    sourceForms,
    sourceFormsLoading,
    validation,
  ]);

  // A dangling `#{name}` renders as written rather than breaking the form, so
  // it is worth a confirmation but not a refusal — an admin renaming a variable
  // would otherwise be unable to save until every reference was updated.
  const unresolvedVariableReferences = useMemo(
    () => collectUnresolvedVariableReferences(schema),
    [schema],
  );

  const liveValidationErrors = useMemo(
    () => validateFormSchema(schema, validation),
    [schema, validation],
  );
  const invalidIds = useMemo(
    () => new Set(liveValidationErrors.map((error) => error.blockId)),
    [liveValidationErrors],
  );

  const handleSaveForm = useCallback(() => {
    if (unresolvedVariableReferences.length > 0) {
      setConfirmUnresolvedVariables(true);
      return;
    }
    void saveForm();
  }, [saveForm, unresolvedVariableReferences]);

  const closeConflict = useCallback(() => setConflict(null), []);

  // Overwrite only if their snapshot is still current.
  const handleKeepMine = useCallback(async () => {
    if (!conflict) return;
    if (displayOnlySave) {
      setIsSaving(true);
      setSaveError(null);
      try {
        const result = await displayOnlySave({
          schema: conflict.mine,
          expectedSnapshotId: conflict.theirsSnapshotId,
        });
        if (R.isFailure(result)) {
          setConflict({
            base: conflict.base,
            mine: conflict.mine,
            theirs: result.error.theirs,
            theirsSnapshotId: result.error.theirsSnapshotId,
          });
          showErrorToast("Someone saved again — review the latest changes");
          return;
        }
        amendSchema(conflict.mine);
        setLastSavedSchemaJSON(JSON.stringify(conflict.mine));
        setBaseFormSnapshotId(result.value.snapshotId);
        setHasUnsavedChanges(false);
        setConflict(null);
        showSuccessToast("Saved your version");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not save";
        setSaveError(message);
        showErrorToast(message);
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!formId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await tasksUpdateFormAdmin({
        path: { formId },
        body: {
          schema: conflict.mine as unknown as Record<string, unknown>,
          expectedFormSnapshotId: conflict.theirsSnapshotId,
        },
      });
      if (response.response.status === 409) {
        const latest = await tasksGetForm({ path: { id: formId } });
        const latestData = latest.data as
          | { schema?: unknown; formSnapshotId?: number }
          | undefined;
        if (
          latestData?.schema &&
          typeof latestData.formSnapshotId === "number"
        ) {
          setConflict({
            base: conflict.base,
            mine: conflict.mine,
            theirs: ensurePages(latestData.schema as FormSchema),
            theirsSnapshotId: latestData.formSnapshotId,
          });
        }
        showErrorToast("Someone saved again — review the latest changes");
        return;
      }
      if (response.response.ok && response.data) {
        void invalidateForms();
        amendSchema(conflict.mine);
        setLastSavedSchemaJSON(JSON.stringify(conflict.mine));
        setBaseFormSnapshotId(response.data.formSnapshotId);
        setHasUnsavedChanges(false);
        setConflict(null);
        showSuccessToast("Saved your version");
      } else {
        setSaveError("Could not save form");
        showErrorToast("Could not save form");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save form";
      setSaveError(message);
      showErrorToast(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    conflict,
    displayOnlySave,
    formId,
    invalidateForms,
    amendSchema,
    showErrorToast,
    showSuccessToast,
  ]);

  const handleTakeTheirs = useCallback(() => {
    if (!conflict) return;
    if (
      !window.confirm(
        "Discard your changes and load their current version? Copy your version first if you want to keep it.",
      )
    ) {
      return;
    }
    loadSchema(conflict.theirs);
    reloadEditors();
    setLastSavedSchemaJSON(JSON.stringify(conflict.theirs));
    setBaseFormSnapshotId(conflict.theirsSnapshotId);
    setHasUnsavedChanges(false);
    setConflict(null);
  }, [conflict, loadSchema, reloadEditors]);

  const handleMerge = useCallback(() => {
    if (!conflict) return;
    const result = mergeFormSchemas({
      base: conflict.base,
      mine: conflict.mine,
      theirs: conflict.theirs,
      validation,
    });
    if (!result.ok) {
      showErrorToast("Can't auto-merge — there are conflicting edits");
      return;
    }
    loadSchema(result.value);
    reloadEditors();
    setLastSavedSchemaJSON(JSON.stringify(conflict.theirs));
    setBaseFormSnapshotId(conflict.theirsSnapshotId);
    setConflict(null);
    showSuccessToast("Merged their changes with yours — review and save");
  }, [
    conflict,
    loadSchema,
    reloadEditors,
    showErrorToast,
    showSuccessToast,
    validation,
  ]);

  const handleCopyMine = useCallback(async () => {
    if (!conflict) return;
    if (await copyToClipboard(JSON.stringify(conflict.mine, null, 2))) {
      showSuccessToast("Copied your version to the clipboard");
    } else {
      showErrorToast("Could not copy your version to the clipboard");
    }
  }, [conflict, showErrorToast, showSuccessToast]);

  const historyLocked =
    isSaving || isLoading || isPreviewMode || conflict !== null;
  const canUndo = formDraft.canUndo && !historyLocked;
  const canRedo = formDraft.canRedo && !historyLocked;
  const { undo: undoDraft, redo: redoDraft } = formDraft;
  const travel = useCallback(
    (move: () => void) => {
      keepPage(move);
      reloadEditors();
      setInsertion(null);
    },
    [keepPage, reloadEditors],
  );
  const undo = useCallback(() => travel(undoDraft), [travel, undoDraft]);
  const redo = useCallback(() => travel(redoDraft), [travel, redoDraft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (!hasUnsavedChanges || isSaving || isLoading) {
          return;
        }
        void handleSaveForm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSaveForm, hasUnsavedChanges, isLoading, isSaving]);

  const replaceFields = (fields: PageItem[], pageIndex = selectedPageIndex) => {
    const before = schema.pages[pageIndex];
    if (!before) return;
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === pageIndex ? { ...page, fields } : page,
      ),
    });
    setSelection((current) =>
      current.pageId === before.id
        ? {
            ...current,
            target: followElement({
              before: before.fields,
              after: fields,
              target: current.target,
            }),
          }
        : current,
    );
  };

  const removeElement = (index: number) => {
    if (
      resolvedTarget.kind === CanvasTargetKind.Element &&
      resolvedTarget.index === index
    ) {
      setSection(SidebarSection.Content);
    }
    replaceFields(currentPage.fields.filter((_, i) => i !== index));
  };

  const moveElement = (
    { from, dropIndex, position }: ListMove,
    pageIndex = selectedPageIndex,
  ) => {
    const moved = moveItem({
      items: schema.pages[pageIndex]?.fields ?? [],
      draggedIndex: from,
      dropIndex,
      position,
    });
    if (moved) replaceFields(moved.items, pageIndex);
  };

  const duplicateElement = (index: number) => {
    const element = currentPage.fields[index];
    if (!element) return;
    insertAndSelect(copyElementWithUniqueIds(element, schema), {
      groupKey: (element.id && canvasGroups.get(element.id)) || null,
      index: index + 1,
    });
  };

  const applyGrouped = ({ pages, groups }: GroupedPages) =>
    updateSchema({ ...schema, pages }, groups);

  const updateElementAt = (index: number) => {
    const field = currentPage.fields[index];
    return (updates: Partial<PageItem>) => {
      if (!field) return;
      const optionValueChange =
        isQuestionField(field) &&
        fieldHasOptions(field) &&
        "options" in updates &&
        updates.options
          ? findSingleOptionValueChange(field.options, updates.options)
          : null;

      const nextPages = schema.pages.map((page, pageIndex) => {
        if (pageIndex === selectedPageIndex) {
          const updatedFields = page.fields.map((f, i) =>
            i === index ? ({ ...f, ...updates } as PageItem) : f,
          );

          if (!optionValueChange) {
            return { ...page, fields: updatedFields };
          }

          const fieldsWithUpdatedConditions =
            applyOptionValueToConditionalVisibility(
              updatedFields,
              (field as AnyField).id,
              optionValueChange.previousValue,
              optionValueChange.nextValue,
            );

          return { ...page, fields: fieldsWithUpdatedConditions };
        }

        if (optionValueChange && pageIndex > selectedPageIndex) {
          const fieldsWithUpdatedConditions =
            applyOptionValueToConditionalVisibility(
              page.fields,
              (field as AnyField).id,
              optionValueChange.previousValue,
              optionValueChange.nextValue,
            );
          const pageFormulaResult = getUpdatedVisibilityFormula(
            page.visibleIfFormula,
            (field as AnyField).id,
            optionValueChange.previousValue,
            optionValueChange.nextValue,
          );

          if (
            fieldsWithUpdatedConditions !== page.fields ||
            pageFormulaResult.changed
          ) {
            return {
              ...page,
              ...(pageFormulaResult.changed
                ? { visibleIfFormula: pageFormulaResult.visibleIfFormula }
                : {}),
              fields: fieldsWithUpdatedConditions,
            };
          }
        }

        return page;
      });

      updateSchema({
        ...schema,
        pages: nextPages,
      });
    };
  };

  const selectChildOf =
    (index: number) => (child: ChildTarget, options?: { focus: true }) => {
      const element = currentPage.fields[index];
      if (!element) return;
      select(
        { ...elementTarget(element, index), child },
        SidebarSection.Content,
      );
      if (options?.focus) setFocusPending(true);
    };

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
      onRemove: () => removeElement(index),
      previousFields,
      laterFields,
    };
    return (
      <ElementExpressionScope
        parent={`element:${currentPage.id}`}
        id={field.id}
      >
        <VisibilityGroupContext.Provider
          value={
            displayOnly
              ? null
              : visibilityGroupRole({
                  pages: schema.pages,
                  pageIndex: selectedPageIndex,
                  index,
                  groups: visibilityGroups,
                  setGroups,
                  applyGrouped,
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
                ? () => removePage(selectedPageIndex)
                : null
            }
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
          return (
            <ElementExpressionScope
              parent={`element:${currentPage.id}`}
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
                editorKey={`${targetKey(currentPage, resolvedTarget)}-${schemaLoads}`}
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
            onDelete={() => removeElement(index)}
          >
            <div key={`${element.id || index}-${schemaLoads}`}>
              {renderElementEditor(index)}
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
              validationErrors={liveValidationErrors}
              onSelectMember={(memberIndex) =>
                select(
                  elementTarget(currentPage.fields[memberIndex]!, memberIndex),
                  SidebarSection.Content,
                )
              }
              onRekey={(key) =>
                setSelection({
                  pageId: currentPage.id,
                  target: { kind: CanvasTargetKind.Group, key },
                })
              }
            />
          </SettingsSidebar>
        );
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
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-end gap-4 flex-wrap xl:flex-nowrap">
                  <div className="flex items-center space-x-2">
                    {!isPreviewMode && (
                      <HistoryControls
                        scope={builderRef}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                      />
                    )}
                    {!isPreviewMode && (
                      <FormJsonButton
                        label="Edit form JSON"
                        onClick={() =>
                          setJsonScope({ kind: JsonScopeKind.Form })
                        }
                        className="h-8 w-8 rounded-md hover:bg-gray-100"
                      />
                    )}
                    {activeEditor === "form" && (
                      <Button
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        color={ButtonColor.Stone}
                        size="small"
                      >
                        {isPreviewMode ? "Edit" : "Preview"}
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveForm}
                      disabled={isSaving || isLoading || !hasUnsavedChanges}
                      color={ButtonColor.Blue}
                      size="small"
                    >
                      {isSaving
                        ? "Saving..."
                        : hasUnsavedChanges
                          ? "Save Form"
                          : "No changes"}
                    </Button>
                  </div>
                  {!displayOnly && (
                    <div className="inline-flex rounded-md bg-gray-200 p-0.5 text-sm font-medium text-gray-600">
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-md text-nowrap",
                          activeEditor === "form"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600",
                        )}
                        onClick={() => setActiveEditor("form")}
                      >
                        Form Builder
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-md text-nowrap",
                          activeEditor === "shareable"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600",
                        )}
                        onClick={() => setActiveEditor("shareable")}
                      >
                        Shareable Text
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-md text-nowrap",
                          activeEditor === "outputs"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600",
                        )}
                        onClick={() => setActiveEditor("outputs")}
                      >
                        Output View
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-md text-nowrap",
                          activeEditor === "aggregates"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600",
                        )}
                        onClick={() => setActiveEditor("aggregates")}
                      >
                        Aggregate Views
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-md text-nowrap",
                          activeEditor === "variables"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600",
                        )}
                        onClick={() => setActiveEditor("variables")}
                      >
                        Variables
                        {(schema.variables?.length ?? 0) > 0 && (
                          <span className="ml-1.5 rounded-full bg-gray-300 px-1.5 py-0.5 text-xs text-gray-700">
                            {schema.variables?.length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 mx-4 min-h-0 relative">
                {isLoading && (
                  <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 mb-2">
                    <span className="block sm:inline">Loading form...</span>
                  </div>
                )}
                {loadError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-2">
                    <span className="block sm:inline">
                      Error loading form: {loadError}
                    </span>
                  </div>
                )}
                {saveError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-2">
                    <span className="block sm:inline">
                      Error saving form: {saveError}
                    </span>
                  </div>
                )}
              </div>

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
                    <DisplayOnlyPreview
                      schema={schema}
                      title={displayOnlyTitle}
                    />
                  </div>
                ) : isPreviewMode ? (
                  <div className="max-w-3xl mx-auto bg-white p-6">
                    <PreviewAsUserBar
                      previewUserId={previewUserId}
                      setPreviewUserId={setPreviewUserId}
                      previewUsers={previewUsers}
                      isLoadingPreviewUsers={isLoadingPreviewUsers}
                      previewUserError={previewUserError}
                    />
                    <FormRenderer
                      key={resolvedPreviewUserId}
                      id={0}
                      formSnapshotId={null}
                      actionId={0}
                      form={schema}
                      onSubmit={null}
                      renderFormAsCompleted={false}
                      userId={resolvedPreviewUserId}
                      user={resolvedPreviewUser}
                      adminPreviewUserId={resolvedPreviewUserId}
                      showVariableError
                      initialPageIndex={selectedPageIndex}
                    />
                  </div>
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
                        selectionKey={targetKey(currentPage, resolvedTarget)}
                        onSelect={(pageIndex, target) =>
                          selectFromOutline({
                            page: schema.pages[pageIndex]!,
                            pageIndex,
                            target,
                          })
                        }
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
                    settingsKey={targetKey(currentPage, resolvedTarget)}
                    canvas={
                      <FormCanvas
                        page={currentPage}
                        groups={canvasGroups}
                        displayOnly={displayOnly}
                        selected={resolvedTarget}
                        onSelect={select}
                        summarize={summarize}
                        invalidIds={invalidIds}
                        renderInsertPoint={renderInsertPoint}
                        onMove={moveElement}
                        onUpdateElement={(index, updates) =>
                          updateElementAt(index)(updates)
                        }
                        onUpdateBlockById={updateBlockById}
                        onUpdatePage={updateCurrentPage}
                      />
                    }
                    settings={renderSettings()}
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
