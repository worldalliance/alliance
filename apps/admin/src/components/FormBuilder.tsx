/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type DisplayBlock,
  type DisplayKind,
} from "@alliance/common/forms/display-blocks";
import { isDisplayOnlyBlockKind } from "@alliance/common/forms/display-only-schema";
import {
  fieldHasOptions,
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
  type ListField,
  type ListSubField,
  type OptionField,
  type Page,
} from "@alliance/common/forms/form-schema";
import { validateFormSchema } from "@alliance/common/forms/form-schema-validate";
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
  userListAdmin,
  type UserDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { customComponentRegistry } from "@alliance/sharedweb/forms/components";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBeforeUnload, useBlocker, useSearchParams } from "react-router";
import { BLOCK_ELEMENTS } from "../lib/blockElements";
import { mergeFormSchemas } from "../lib/formSchemaMerge";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { AggregateBuilder } from "./AggregateBuilder";
import {
  EditableBigLinkBlock,
  EditableChatTranscriptBlock,
  EditableCopyTextBlock,
  EditableDividerBlock,
  EditableHeaderBlock,
  EditableHtmlBlock,
  EditableImageBlock,
  EditableLabelBlock,
  EditablePreviousAnswerBlock,
  EditableSpacerBlock,
  EditableTextBlock,
  EditableUserLocationBlock,
  EditableVideoBlock,
  PerViewerOptions,
} from "./display-blocks";
import { EditableQuoteBlock } from "./display-blocks/EditableQuoteBlock";
import { DisplayOnlyPreview } from "./DisplayOnlyPreview";
import { ElementSelect } from "./ElementSelect";
import {
  EditableCheckboxField,
  EditableCityField,
  EditableContractField,
  EditableCustomComponentField,
  EditableDateField,
  EditableEmailField,
  EditableFileField,
  EditableListField,
  EditableMultiSelectField,
  EditableNumberField,
  EditablePhoneField,
  EditableRadioField,
  EditableRangeField,
  EditableRankingField,
  EditableSelectField,
  EditableTextField,
  EditableTextareaField,
  EditableTimeField,
  EditableTimezoneField,
} from "./form-fields";
import { ConditionalVisibility } from "./form-fields/CommonControls";
import {
  CustomValidatorDraft,
  CustomValidatorDraftsContext,
  isDraftValidatorId,
} from "./form-fields/customValidatorDrafts";
import { FormConflictModal } from "./FormConflictModal";
import { OutputBuilder } from "./OutputBuilder";
import { PreviewAsUserBar } from "./PreviewAsUserBar";
import { ShareableTextBuilder } from "./ShareableTextBuilder";

const FIELD_NAMES = {
  textarea: "Text Area Field",
  email: "Email Field",
  phone: "Phone Field",
  number: "Number Field",
  range: "Range Field",
  checkbox: "Checkbox Field",
  radio: "Radio Field",
  select: "Select Field",
  multiselect: "Multi-select Field",
  ranking: "Ranking Field",
  date: "Date Field",
  time: "Time Field",
  timezone: "Timezone Field",
  city: "City Field",
  file: "File Field",
  contract: "Contract Field",
  list: "List Field",
  custom: "Custom Component Field",
} as const satisfies Record<Exclude<FieldKind, "text">, string>;

type AvailableElement =
  | {
      [K in keyof typeof FIELD_NAMES]: {
        id: K;
        name: (typeof FIELD_NAMES)[K];
        type: "field";
      };
    }[keyof typeof FIELD_NAMES]
  | {
      [K in DisplayKind]: {
        id: (typeof BLOCK_ELEMENTS)[K]["id"];
        name: (typeof BLOCK_ELEMENTS)[K]["name"];
        type: "block";
        kind: K;
      };
    }[DisplayKind]
  | { id: "copy-existing"; name: "Copy Existing Element"; type: "copy" };

const AVAILABLE_ELEMENTS = [
  ...Object.entries(FIELD_NAMES).map(([id, name]) => ({
    id,
    name,
    type: "field",
  })),
  ...Object.entries(BLOCK_ELEMENTS).map(([kind, { id, name }]) => ({
    id,
    name,
    type: "block",
    kind,
  })),
  { id: "copy-existing", name: "Copy Existing Element", type: "copy" },
] as AvailableElement[];

const DISPLAY_ONLY_ELEMENTS = AVAILABLE_ELEMENTS.filter(
  (element) => element.type === "block" && isDisplayOnlyBlockKind(element.kind),
);

const ELEMENT_TYPE_BADGES: Record<
  AvailableElement["type"],
  { label: string; className: string }
> = {
  field: { label: "Field", className: "bg-blue-100 text-blue-800" },
  block: { label: "Block", className: "bg-green-100 text-green-800" },
  copy: { label: "Copy", className: "bg-purple-100 text-purple-800" },
};

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

const buildValueCounts = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
};

const findSingleOptionValueChange = (
  previousOptions: OptionField["options"] | undefined,
  nextOptions: OptionField["options"] | undefined,
): {
  previousValue: string;
  nextValue: string;
} | null => {
  if (!previousOptions || !nextOptions) {
    return null;
  }
  if (previousOptions.length !== nextOptions.length) {
    return null;
  }

  const previousValues = previousOptions.map((option) => option.value ?? "");
  const nextValues = nextOptions.map((option) => option.value ?? "");
  const previousCounts = buildValueCounts(previousValues);
  const nextCounts = buildValueCounts(nextValues);

  const removed: string[] = [];
  const added: string[] = [];

  previousCounts.forEach((count, value) => {
    const nextCount = nextCounts.get(value) ?? 0;
    if (nextCount < count) {
      for (let i = 0; i < count - nextCount; i += 1) {
        removed.push(value);
      }
    }
  });

  nextCounts.forEach((count, value) => {
    const previousCount = previousCounts.get(value) ?? 0;
    if (previousCount < count) {
      for (let i = 0; i < count - previousCount; i += 1) {
        added.push(value);
      }
    }
  });

  if (removed.length === 1 && added.length === 1) {
    return {
      previousValue: removed[0],
      nextValue: added[0],
    };
  }

  return null;
};

const mapConditionForOptionValue = (
  condition: Condition,
  controllerId: string,
  previousValue: string,
  nextValue: string,
): { condition: Condition; updated: boolean } => {
  switch (condition.kind) {
    case "includesOption":
      if (
        condition.when === controllerId &&
        condition.includesOption === previousValue
      ) {
        return {
          condition: { ...condition, includesOption: nextValue },
          updated: true,
        };
      }
      return { condition, updated: false };
    case "equals":
      if (
        condition.when === controllerId &&
        condition.equals === previousValue
      ) {
        return {
          condition: { ...condition, equals: nextValue },
          updated: true,
        };
      }
      return { condition, updated: false };
    case "anySelected":
    case "completedActionCount":
    case "deviceType":
    case "firstContractSigned":
    case "hasValue":
    case "outputBlockVisible":
    case "userHasCity":
    case "validator":
      return { condition, updated: false };
    default:
      throw new Error(
        `Unknown condition kind: ${(condition satisfies never as Condition).kind}`,
      );
  }
};

const getUpdatedVisibilityFormula = (
  visibleIfFormula: VisibleIfFormula | undefined,
  controllerId: string,
  previousValue: string,
  nextValue: string,
): { changed: boolean; visibleIfFormula?: VisibleIfFormula } => {
  if (!visibleIfFormula?.conditions) {
    return { changed: false };
  }

  let updated = false;
  const nextConditions: Record<string, Condition> = {};
  for (const [name, cond] of Object.entries(visibleIfFormula.conditions)) {
    const { condition, updated: u } = mapConditionForOptionValue(
      cond,
      controllerId,
      previousValue,
      nextValue,
    );
    nextConditions[name] = condition;
    if (u) updated = true;
  }

  if (!updated) {
    return { changed: false };
  }

  return {
    changed: true,
    visibleIfFormula: { ...visibleIfFormula, conditions: nextConditions },
  };
};

const applyOptionValueToConditionalVisibility = (
  fields: Array<AnyField | DisplayBlock>,
  controllerId: string,
  previousValue: string,
  nextValue: string,
  startIndex: number,
) => {
  let hasChanges = false;

  const nextFields = fields.map((candidate, idx) => {
    if (idx <= startIndex) {
      return candidate;
    }

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

const collectFormElementIds = (
  elements: Array<AnyField | DisplayBlock>,
  usedIds: Set<string>,
) => {
  elements.forEach((element) => {
    if (element.id) {
      usedIds.add(element.id);
    }
    if (isQuestionField(element) && "fields" in element) {
      collectFormElementIds(element.fields, usedIds);
    }
  });
};

const collectSchemaIds = (schema: FormSchema) => {
  const usedIds = new Set<string>();
  schema.pages.forEach((page) => {
    usedIds.add(page.id);
    collectFormElementIds(page.fields, usedIds);
  });
  schema.outputViews.forEach((view) => {
    usedIds.add(view.id);
    view.blocks.forEach((block) => {
      if (block.id) {
        usedIds.add(block.id);
      }
    });
  });
  schema.aggregateViews?.forEach((view) => usedIds.add(view.id));
  return usedIds;
};

const remapConditionFieldReferences = (
  condition: Condition,
  idMap: ReadonlyMap<string, string>,
): Condition => {
  switch (condition.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
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
      return { ...element, id: nextId };
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
  element: AnyField | DisplayBlock,
  schema: FormSchema,
): AnyField | DisplayBlock => {
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

  return { ...cloned, id: createUniqueFormBuilderId("block", usedIds) };
};

const displayBlockPreview = (block: DisplayBlock): string => {
  switch (block.kind) {
    case "header":
    case "text":
    case "label":
    case "quote":
    case "biglink":
      return block.text;
    case "copytext":
      return block.title || block.text;
    case "divider":
      return block.thickness ?? "";
    case "spacer":
      return block.size ?? "";
    case "html":
      return block.html;
    case "image":
      return block.alt || block.src;
    case "video":
      return block.caption ?? block.src;
    case "previousAnswer":
      return block.title || block.sourceFieldId;
    case "userLocation":
      return block.title ?? "";
    case "chatTranscript":
      return `${block.messages.length} message${block.messages.length === 1 ? "" : "s"}`;
    default:
      block satisfies never;
      return "";
  }
};

const truncatePreview = (text: string, max = 40) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const describeCopyableElement = (element: AnyField | DisplayBlock): string => {
  if (isQuestionField(element)) {
    const typeName =
      element.kind === "text" ? "Text Field" : FIELD_NAMES[element.kind];
    return element.label
      ? `${typeName}: ${truncatePreview(element.label)}`
      : typeName;
  }
  const typeName = BLOCK_ELEMENTS[element.kind].name;
  const preview = displayBlockPreview(element);
  return preview ? `${typeName}: ${truncatePreview(preview)}` : typeName;
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

  const buildInitialSchema = () =>
    initialSchema
      ? ensurePages(initialSchema)
      : {
          title: !!actionName ? actionName + " form" : "Untitled Form",
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

  const [schema, setSchema] = useState<FormSchema>(buildInitialSchema);
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

  const [searchParams, setSearchParams] = useSearchParams();

  const activeEditor = displayOnly
    ? "form"
    : (searchParams.get("editor") ?? "form");

  const setActiveEditor = useCallback(
    (editor: "form" | "shareable" | "outputs" | "aggregates") => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("editor", editor);
        return next;
      });
    },
    [setSearchParams],
  );

  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [draggedItem, setDraggedItem] = useState<{
    index: number;
    pageIndex: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null,
  );

  // Page drag and drop state
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(
    null,
  );
  const [pageDropPosition, setPageDropPosition] = useState<
    "before" | "after" | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<UserDto[]>([]);
  const [previewUserId, setPreviewUserId] = useState<string>("preview");
  const [isLoadingPreviewUsers, setIsLoadingPreviewUsers] = useState(false);
  const [previewUserError, setPreviewUserError] = useState<string | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<AvailableElement>>(
    [],
  );
  const [copyPickerIndex, setCopyPickerIndex] = useState<number | null>(null);
  const [customValidatorDrafts, setCustomValidatorDrafts] = useState<
    Record<number, CustomValidatorDraft>
  >({});
  const draftValidatorIdRef = useRef(-1);
  const createDraftId = useCallback(() => {
    const nextId = draftValidatorIdRef.current;
    draftValidatorIdRef.current -= 1;
    return nextId;
  }, []);
  const setDraft = useCallback(
    (draftId: number, draft: CustomValidatorDraft) => {
      setCustomValidatorDrafts((prev) => ({ ...prev, [draftId]: draft }));
    },
    [],
  );
  const removeDraft = useCallback((draftId: number) => {
    setCustomValidatorDrafts((prev) => {
      if (!(draftId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
  }, []);
  const customValidatorDraftContext = useMemo(
    () => ({
      drafts: customValidatorDrafts,
      setDraft,
      removeDraft,
      createDraftId,
    }),
    [createDraftId, customValidatorDrafts, removeDraft, setDraft],
  );
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const currentPage = schema.pages[selectedPageIndex] ??
    schema.pages?.[0] ?? { id: "page-1", title: "Page 1", fields: [] };
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

  useEffect(() => {
    if (Object.keys(customValidatorDrafts).length === 0) {
      return;
    }
    const activeDraftIds = new Set<number>();

    const collectFromVisibleIfFormula = (visibleIfFormula?: {
      conditions: Record<string, Condition>;
    }) => {
      if (!visibleIfFormula?.conditions) return;
      Object.values(visibleIfFormula.conditions).forEach((condition) => {
        if (
          condition.kind === "validator" &&
          isDraftValidatorId(condition.validatorId)
        ) {
          activeDraftIds.add(condition.validatorId);
        }
      });
    };

    schema.pages.forEach((page) => {
      collectFromVisibleIfFormula(page.visibleIfFormula);
      page.fields.forEach((field) => {
        if (isQuestionField(field)) {
          if (isDraftValidatorId(field.customValidatorId)) {
            activeDraftIds.add(field.customValidatorId);
          }
        }
        collectFromVisibleIfFormula(field.visibleIfFormula);
      });
    });

    schema.outputViews.forEach((view) => {
      view.blocks.forEach((block) => {
        collectFromVisibleIfFormula(block.visibleIfFormula);
      });
    });

    setCustomValidatorDrafts((prev) => {
      const next: Record<number, CustomValidatorDraft> = {};
      let hasChanges = false;
      Object.entries(prev).forEach(([id, draft]) => {
        const numericId = Number(id);
        if (activeDraftIds.has(numericId)) {
          next[numericId] = draft;
        } else {
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [customValidatorDrafts, schema]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = availableElements.filter((element) =>
        element.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [availableElements, searchQuery]);

  const handleSearchSelect = (
    element: AvailableElement,
    insertIndex: number,
  ) => {
    switch (element.type) {
      case "field":
        addField(element.id, insertIndex);
        break;
      case "block":
        addDisplayBlock(element.kind, insertIndex);
        break;
      case "copy":
        setCopyPickerIndex(insertIndex);
        break;
      default:
        throw new Error(
          `Unknown element type: ${(element satisfies never as AvailableElement).type}`,
        );
    }
    setActiveSearchIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent, insertIndex: number) => {
    if (e.key === "Escape") {
      setActiveSearchIndex(null);
      setSearchQuery("");
      setSearchResults([]);
    } else if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      handleSearchSelect(searchResults[0], insertIndex);
    }
  };

  // Click outside handler
  const handleClickOutside = () => {
    if (activeSearchIndex !== null) {
      setActiveSearchIndex(null);
      setSearchQuery("");
      setSearchResults([]);
    }
    if (copyPickerIndex !== null) {
      setCopyPickerIndex(null);
    }
  };

  // The copy picker's insert index is relative to the current page, so it
  // can't survive a page switch.
  useEffect(() => {
    setCopyPickerIndex(null);
  }, [selectedPageIndex]);

  // Load form data when formId changes
  useEffect(() => {
    if (displayOnly || !formId || initialSchema) return;
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
            setSchema(nextSchema);
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
  }, [displayOnly, formId, initialSchema]);

  const addField = (kind: FieldKind, insertIndex?: number) => {
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
          defaultValue: "America/Los_Angeles",
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

    const targetIndex = insertIndex ?? currentPage.fields.length;
    const newFields = [...currentPage.fields];
    newFields.splice(targetIndex, 0, newField);

    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, fields: newFields } : page,
      ),
    });
  };

  const addDisplayBlock = (kind: DisplayKind, insertIndex?: number) => {
    const blockId = `block-${Date.now()}`;
    let newBlock: DisplayBlock;

    switch (kind) {
      case "header":
        newBlock = {
          type: "display",
          kind: "header",
          id: blockId,
          text: "Header Text",
          level: 2,
        };
        break;
      case "text":
        newBlock = {
          type: "display",
          kind: "text",
          id: blockId,
          text: "Text content",
        };
        break;
      case "label":
        newBlock = {
          type: "display",
          kind: "label",
          id: blockId,
          text: "Label text",
        };
        break;
      case "divider":
        newBlock = {
          type: "display",
          kind: "divider",
          id: blockId,
          thickness: "thin",
        };
        break;
      case "spacer":
        newBlock = { type: "display", kind: "spacer", id: blockId, size: "md" };
        break;
      case "html":
        newBlock = {
          type: "display",
          kind: "html",
          id: blockId,
          html: "<p>Custom HTML content</p>",
        };
        break;
      case "image":
        newBlock = {
          type: "display",
          kind: "image",
          id: blockId,
          alt: "Image",
          src: "https://via.placeholder.com/300x200",
        };
        break;
      case "video":
        newBlock = {
          type: "display",
          kind: "video",
          id: blockId,
          src: "",
        };
        break;
      case "quote":
        newBlock = {
          type: "display",
          kind: "quote",
          id: blockId,
          text: "body text",
        };
        break;
      case "biglink":
        newBlock = {
          type: "display",
          kind: "biglink",
          id: blockId,
          text: "Link title",
          url: "/",
        };
        break;
      case "copytext":
        newBlock = {
          type: "display",
          kind: "copytext",
          id: blockId,
          text: "",
        };
        break;
      case "previousAnswer":
        newBlock = {
          type: "display",
          kind: "previousAnswer",
          id: blockId,
          sourceFormId: 0,
          sourceFieldId: "",
          title: "",
          showLabel: true,
        };
        break;
      case "userLocation":
        newBlock = {
          type: "display",
          kind: "userLocation",
          id: blockId,
          title: "Your location",
          emptyText: "No location set",
        };
        break;
      case "chatTranscript":
        newBlock = {
          type: "display",
          kind: "chatTranscript",
          id: blockId,
          messages: [],
        };
        break;
      default:
        console.error(`Unknown block kind: ${kind satisfies never}`);
        return;
    }

    const targetIndex = insertIndex ?? currentPage.fields.length;
    const newFields = [...currentPage.fields];
    newFields.splice(targetIndex, 0, newBlock);

    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, fields: newFields } : page,
      ),
    });
  };

  const insertCopiedElement = (
    source: AnyField | DisplayBlock,
    insertIndex: number,
  ) => {
    const copied = copyElementWithUniqueIds(source, schema);
    const newFields = [...currentPage.fields];
    newFields.splice(insertIndex, 0, copied);

    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, fields: newFields } : page,
      ),
    });
    setCopyPickerIndex(null);
  };

  const updateSchema = (newSchema: FormSchema) => {
    setSchema(ensureSchemaViews(newSchema));
  };

  const resolveCustomValidatorDrafts = useCallback(
    async (schemaToSave: FormSchema) => {
      const draftIds = new Set<number>();

      const collectFromVisibleIfFormula = (visibleIfFormula?: {
        conditions: Record<string, Condition>;
      }) => {
        if (!visibleIfFormula?.conditions) return;
        Object.values(visibleIfFormula.conditions).forEach((condition) => {
          if (
            condition.kind === "validator" &&
            isDraftValidatorId(condition.validatorId)
          ) {
            draftIds.add(condition.validatorId);
          }
        });
      };

      schemaToSave.pages.forEach((page) => {
        collectFromVisibleIfFormula(page.visibleIfFormula);
        page.fields.forEach((field) => {
          if (
            isQuestionField(field) &&
            isDraftValidatorId(field.customValidatorId)
          ) {
            draftIds.add(field.customValidatorId);
          }
          collectFromVisibleIfFormula(field.visibleIfFormula);
        });
      });

      schemaToSave.outputViews.forEach((view) => {
        view.blocks.forEach((block) => {
          collectFromVisibleIfFormula(block.visibleIfFormula);
        });
      });

      if (draftIds.size === 0) {
        return { schema: schemaToSave, resolvedDraftIds: [] as number[] };
      }

      const resolvedIds = new Map<number, number>();
      await Promise.all(
        [...draftIds].map(async (draftId) => {
          const draft = customValidatorDrafts[draftId];
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
          resolvedIds.set(draftId, response.data.id);
        }),
      );

      const mapCondition = (condition: Condition): Condition => {
        if (
          condition.kind === "validator" &&
          isDraftValidatorId(condition.validatorId)
        ) {
          const nextId = resolvedIds.get(condition.validatorId);
          if (!nextId) {
            return condition;
          }
          return { ...condition, validatorId: nextId };
        }
        return condition;
      };

      const mapVisibleIfFormula = (
        visibleIfFormula?: VisibleIfFormula,
      ): VisibleIfFormula | undefined => {
        if (!visibleIfFormula?.conditions) return visibleIfFormula;
        const nextConditions: Record<string, Condition> = {};
        for (const [name, cond] of Object.entries(
          visibleIfFormula.conditions,
        )) {
          nextConditions[name] = mapCondition(cond);
        }
        return {
          ...visibleIfFormula,
          conditions: nextConditions,
        };
      };

      const nextSchema: FormSchema = {
        ...schemaToSave,
        pages: schemaToSave.pages.map((page) => ({
          ...page,
          visibleIfFormula: mapVisibleIfFormula(page.visibleIfFormula),
          fields: page.fields.map((field) => {
            const nextVisibleIfFormula = mapVisibleIfFormula(
              field.visibleIfFormula,
            );
            if (isQuestionField(field)) {
              const nextValidatorId = isDraftValidatorId(
                field.customValidatorId,
              )
                ? (resolvedIds.get(field.customValidatorId) ??
                  field.customValidatorId)
                : field.customValidatorId;
              return {
                ...field,
                customValidatorId: nextValidatorId,
                visibleIfFormula: nextVisibleIfFormula,
              };
            }
            return {
              ...field,
              visibleIfFormula: nextVisibleIfFormula,
            };
          }),
        })),
        outputViews: schemaToSave.outputViews.map((view) => ({
          ...view,
          blocks: view.blocks.map((block) => ({
            ...block,
            visibleIfFormula: mapVisibleIfFormula(block.visibleIfFormula),
          })),
        })),
      };

      return {
        schema: nextSchema,
        resolvedDraftIds: [...resolvedIds.keys()],
      };
    },
    [customValidatorDrafts],
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

  const fetchPreviewUsers = useCallback(async () => {
    if (isLoadingPreviewUsers) {
      return;
    }
    setIsLoadingPreviewUsers(true);
    setPreviewUserError(null);
    try {
      const response = await userListAdmin();
      setPreviewUsers(response.data ?? []);
    } catch (error) {
      console.error("Failed to load users for preview", error);
      setPreviewUserError(
        error instanceof Error ? error.message : "Could not load users",
      );
    } finally {
      setIsLoadingPreviewUsers(false);
    }
  }, [isLoadingPreviewUsers]);

  useEffect(() => {
    if (isPreviewMode && previewUsers.length === 0 && !previewUserError) {
      void fetchPreviewUsers();
    }
  }, [fetchPreviewUsers, isPreviewMode, previewUserError, previewUsers.length]);

  useEffect(() => {
    const scrollContainer = contentScrollRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [selectedPageIndex]);

  const currentPageVisibilityConditionCount = Object.keys(
    currentPage.visibleIfFormula?.conditions ?? {},
  ).length;
  const [showPageVisibilityControl, setShowPageVisibilityControl] = useState(
    () => currentPageVisibilityConditionCount > 0,
  );
  useEffect(() => {
    setShowPageVisibilityControl(
      Object.keys(
        schema.pages[selectedPageIndex]?.visibleIfFormula?.conditions ?? {},
      ).length > 0,
    );
    // Reset the toggle only when switching pages, not on every schema edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageIndex]);
  useEffect(() => {
    if (currentPageVisibilityConditionCount > 0) {
      setShowPageVisibilityControl(true);
    }
  }, [currentPageVisibilityConditionCount]);

  const updateCurrentPageVisibility = (updates: {
    visibleIfFormula?: VisibleIfFormula;
  }) => {
    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex
          ? { ...page, visibleIfFormula: updates.visibleIfFormula }
          : page,
      ),
    });
  };

  const handlePageVisibilityToggle = (checked: boolean) => {
    setShowPageVisibilityControl(checked);
    if (!checked) {
      updateCurrentPageVisibility({ visibleIfFormula: undefined });
    }
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
  };

  const copyPage = (pageIndex: number) => {
    const sourcePage = schema.pages[pageIndex];
    if (!sourcePage) return;

    const copiedPage = copyPageWithUniqueIds(sourcePage, schema);
    const nextPages = [...schema.pages];
    const copiedPageIndex = pageIndex + 1;
    nextPages.splice(copiedPageIndex, 0, copiedPage);

    updateSchema({
      ...schema,
      pages: nextPages,
    });
    setSelectedPageIndex(copiedPageIndex);
    setDraggedPageIndex(null);
    setDragOverPageIndex(null);
    setPageDropPosition(null);
  };

  const removePage = (pageIndex: number) => {
    if (schema.pages.length <= 1) return;
    updateSchema({
      ...schema,
      pages: schema.pages.filter((_, i) => i !== pageIndex),
    });
    if (selectedPageIndex >= schema.pages.length - 1) {
      setSelectedPageIndex(Math.max(0, selectedPageIndex - 1));
    }
  };

  const handleSaveForm = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const validationErrors = validateFormSchema(schema);
      if (validationErrors.length > 0) {
        const summary = validationErrors
          .map((e) => `• Block ${e.blockId}: ${e.message}`)
          .join("\n");
        setSaveError(summary);
        showErrorToast("Fix invalid references before saving");
        return;
      }

      const { schema: schemaForSave, resolvedDraftIds } =
        await resolveCustomValidatorDrafts(schema);
      if (resolvedDraftIds.length > 0) {
        setSchema(schemaForSave);
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
            title: schemaForSave.title,
            schema: schemaForSave as unknown as Record<string, unknown>,
            expectedFormSnapshotId: baseFormSnapshotId ?? undefined,
          },
        });
      } else {
        response = await tasksCreateFormAdmin({
          body: {
            title: schemaForSave.title,
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
        setLastSavedSchemaJSON(JSON.stringify(schemaForSave));
        setBaseFormSnapshotId(response.data.formSnapshotId);
        setHasUnsavedChanges(false);
        skipNavigationBlockRef.current = true;
        setFormId(response.data.id);
        skipNavigationBlockRef.current = false;
        if (resolvedDraftIds.length > 0) {
          setCustomValidatorDrafts((prev) => {
            const next = { ...prev };
            resolvedDraftIds.forEach((draftId) => {
              delete next[draftId];
            });
            return next;
          });
        }
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
    lastSavedSchemaJSON,
    resolveCustomValidatorDrafts,
    schema,
    setFormId,
    showErrorToast,
    showSuccessToast,
  ]);

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
        setSchema(conflict.mine);
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
          title: conflict.mine.title,
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
        setSchema(conflict.mine);
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
  }, [conflict, displayOnlySave, formId, showErrorToast, showSuccessToast]);

  const handleTakeTheirs = useCallback(() => {
    if (!conflict) return;
    if (
      !window.confirm(
        "Discard your changes and load their current version? Copy your version first if you want to keep it.",
      )
    ) {
      return;
    }
    setSchema(conflict.theirs);
    setLastSavedSchemaJSON(JSON.stringify(conflict.theirs));
    setBaseFormSnapshotId(conflict.theirsSnapshotId);
    setHasUnsavedChanges(false);
    setConflict(null);
  }, [conflict]);

  const handleMerge = useCallback(() => {
    if (!conflict) return;
    const result = mergeFormSchemas(
      conflict.base,
      conflict.mine,
      conflict.theirs,
    );
    if (!result.ok) {
      showErrorToast("Can't auto-merge — there are conflicting edits");
      return;
    }
    setSchema(result.value);
    setLastSavedSchemaJSON(JSON.stringify(conflict.theirs));
    setBaseFormSnapshotId(conflict.theirsSnapshotId);
    setConflict(null);
    showSuccessToast("Merged their changes with yours — review and save");
  }, [conflict, showErrorToast, showSuccessToast]);

  const handleCopyMine = useCallback(() => {
    if (!conflict) return;
    void navigator.clipboard.writeText(JSON.stringify(conflict.mine, null, 2));
    showSuccessToast("Copied your version to the clipboard");
  }, [conflict, showSuccessToast]);

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

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedItem({
      index,
      pageIndex: selectedPageIndex,
    });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  // Page drag handlers
  const handlePageDragStart = (pageIndex: number) => (e: React.DragEvent) => {
    setDraggedPageIndex(pageIndex);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePageDragEnd = () => {
    setDraggedPageIndex(null);
    setDragOverPageIndex(null);
    setPageDropPosition(null);
  };

  const handlePageDragOver = (pageIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (draggedPageIndex === null || draggedPageIndex === pageIndex) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const position = e.clientX < midpoint ? "before" : "after";

    setDragOverPageIndex(pageIndex);
    setPageDropPosition(position);
  };

  const handlePageDrop = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();

    if (draggedPageIndex === null || pageDropPosition === null) {
      return;
    }

    // Calculate the actual insertion index
    let insertionIndex = dropIndex;
    if (pageDropPosition === "after") {
      insertionIndex = dropIndex + 1;
    }

    // Adjust for the fact that we're removing the dragged page first
    if (draggedPageIndex < insertionIndex) {
      insertionIndex -= 1;
    }

    if (draggedPageIndex === insertionIndex) {
      handlePageDragEnd();
      return;
    }

    const newPages = [...schema.pages];
    const [draggedPage] = newPages.splice(draggedPageIndex, 1);
    newPages.splice(insertionIndex, 0, draggedPage);

    // Update selected page index if necessary
    let newSelectedPageIndex = selectedPageIndex;
    if (selectedPageIndex === draggedPageIndex) {
      newSelectedPageIndex = insertionIndex;
    } else if (
      selectedPageIndex > draggedPageIndex &&
      selectedPageIndex <= insertionIndex
    ) {
      newSelectedPageIndex = selectedPageIndex - 1;
    } else if (
      selectedPageIndex < draggedPageIndex &&
      selectedPageIndex >= insertionIndex
    ) {
      newSelectedPageIndex = selectedPageIndex + 1;
    }

    updateSchema({
      ...schema,
      pages: newPages,
    });

    setSelectedPageIndex(newSelectedPageIndex);
    handlePageDragEnd();
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!draggedItem || draggedItem.pageIndex !== selectedPageIndex) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? "before" : "after";

    setDragOverIndex(index);
    setDropPosition(position);
  };

  const handleDrop = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();

    if (
      !draggedItem ||
      draggedItem.pageIndex !== selectedPageIndex ||
      !dropPosition
    ) {
      return;
    }

    const { index: dragIndex } = draggedItem;

    // Calculate the actual insertion index
    let insertionIndex = dropIndex;
    if (dropPosition === "after") {
      insertionIndex = dropIndex + 1;
    }

    // Adjust for the fact that we're removing the dragged item first
    if (dragIndex < insertionIndex) {
      insertionIndex -= 1;
    }

    if (dragIndex === insertionIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      setDropPosition(null);
      return;
    }

    const currentFields = [...currentPage.fields];
    const [draggedField] = currentFields.splice(dragIndex, 1);
    currentFields.splice(insertionIndex, 0, draggedField);

    updateSchema({
      ...schema,
      pages: schema.pages.map((page, idx) =>
        idx === selectedPageIndex ? { ...page, fields: currentFields } : page,
      ),
    });

    setDraggedItem(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  // Inline search component - small hover target
  const InlineSearch = ({ insertIndex }: { insertIndex: number }) => {
    const isActive = activeSearchIndex === insertIndex;

    if (isActive) {
      return (
        <div className="relative my-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => handleSearchKeyDown(e, insertIndex)}
              placeholder="Type to search for elements (text, header, divider...)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                {searchResults.map((element) => (
                  <button
                    key={`${element.type}-${element.id}`}
                    onClick={() => handleSearchSelect(element, insertIndex)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none first:rounded-t-md last:rounded-b-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {element.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          ELEMENT_TYPE_BADGES[element.type].className,
                        )}
                      >
                        {ELEMENT_TYPE_BADGES[element.type].label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Larger hover target - only visible on hover, no spacing when not hovering
    return (
      <div className="relative group">
        {/* Larger invisible hover area */}
        <div className="w-full h-6 absolute -top-3 left-0 z-10"></div>

        {/* Visible button on hover - positioned absolutely to not affect layout */}
        <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto pb-4">
          <button
            onClick={() => setActiveSearchIndex(insertIndex)}
            className="pb-[1px] w-8 h-8 bg-white border border-blue-500 hover:bg-blue-200 text-blue-500 rounded-full shadow-lg flex items-center justify-center text-sm font-bold transition-colors"
            title="Add element here"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  // Inline picker for inserting a copy of an existing element. Kept as UI
  // state (not a schema element) so an in-progress pick never gets saved.
  const InlineCopyPicker = ({ insertIndex }: { insertIndex: number }) => {
    const selectRef = useRef<HTMLSelectElement | null>(null);
    const [hasSelection, setHasSelection] = useState(false);
    const hasCopyableElements = schema.pages.some(
      (page) => page.fields.length > 0,
    );

    const commitSelection = () => {
      const value = selectRef.current?.value;
      if (!value) return;
      const [pageIndex, elementIndex] = value.split(":").map(Number);
      const source = schema.pages[pageIndex]?.fields[elementIndex];
      if (source) {
        insertCopiedElement(source, insertIndex);
      }
    };

    return (
      <div className="my-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 rounded-md border border-purple-300 bg-purple-50 px-3 py-2">
          <select
            ref={selectRef}
            autoFocus
            defaultValue=""
            onChange={() => setHasSelection(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCopyPickerIndex(null);
              } else if (e.key === "Enter") {
                e.preventDefault();
                commitSelection();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="" disabled>
              {hasCopyableElements
                ? "Choose an element to copy…"
                : "No elements to copy yet"}
            </option>
            {schema.pages.map(
              (page, pageIndex) =>
                page.fields.length > 0 && (
                  <optgroup
                    key={page.id}
                    label={page.title || `Page ${pageIndex + 1}`}
                  >
                    {page.fields.map((element, elementIndex) => (
                      <option
                        key={element.id || `${pageIndex}:${elementIndex}`}
                        value={`${pageIndex}:${elementIndex}`}
                      >
                        {describeCopyableElement(element)}
                      </option>
                    ))}
                  </optgroup>
                ),
            )}
          </select>
          <button
            type="button"
            onClick={commitSelection}
            disabled={!hasSelection}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
          >
            Insert
          </button>
          <button
            type="button"
            onClick={() => setCopyPickerIndex(null)}
            className="text-gray-400 hover:text-gray-600"
            title="Cancel"
            aria-label="Cancel copy"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  const InsertPoint = ({ insertIndex }: { insertIndex: number }) =>
    copyPickerIndex === insertIndex ? (
      <InlineCopyPicker insertIndex={insertIndex} />
    ) : (
      <InlineSearch insertIndex={insertIndex} />
    );

  const renderField = (field: AnyField | DisplayBlock, index: number) => {
    const updateField = (updates: Partial<AnyField | DisplayBlock>) => {
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
            i === index ? ({ ...f, ...updates } as AnyField | DisplayBlock) : f,
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
              index,
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
              -1,
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

    const removeField = () => {
      updateSchema({
        ...schema,
        pages: schema.pages.map((page, idx) =>
          idx === selectedPageIndex
            ? { ...page, fields: page.fields.filter((_, i) => i !== index) }
            : page,
        ),
      });
    };

    const isDragging =
      draggedItem?.index === index &&
      draggedItem?.pageIndex === selectedPageIndex;
    const showInsertionBar =
      dragOverIndex === index && dropPosition && !isDragging;

    // Build previous answer fields for conditional visibility controls.
    const previousFields = [
      ...schema.pages
        .slice(0, selectedPageIndex)
        .flatMap((page) => page.fields),
      ...currentPage.fields.slice(0, index),
    ].filter(
      (f): f is AnyField => (f as any)?.kind && (f as any)?.label !== undefined,
    );

    const commonProps = {
      onUpdate: updateField,
      onRemove: removeField,
      onDragStart: handleDragStart(index),
      onDragEnd: handleDragEnd,
      isDragging: isDragging,
      previousFields,
    };

    // Render the element with insertion bar indicators
    return (
      <div key={index} className="relative">
        {/* Insertion bar before */}
        {showInsertionBar && dropPosition === "before" && (
          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}

        {/* The actual element */}
        <div
          className="transition-all"
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
        >
          {isQuestionField(field)
            ? (() => {
                const formField = field;
                switch (formField.kind) {
                  case "text":
                    return (
                      <EditableTextField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "textarea":
                    return (
                      <EditableTextareaField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "email":
                    return (
                      <EditableEmailField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "phone":
                    return (
                      <EditablePhoneField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "number":
                    return (
                      <EditableNumberField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "range":
                    return (
                      <EditableRangeField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "checkbox":
                    return (
                      <EditableCheckboxField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "radio":
                    return (
                      <EditableRadioField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "select":
                    return (
                      <EditableSelectField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "multiselect":
                    return (
                      <EditableMultiSelectField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "ranking":
                    return (
                      <EditableRankingField
                        field={formField}
                        {...commonProps}
                      />
                    );
                  case "date":
                    return (
                      <EditableDateField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "time":
                    return (
                      <EditableTimeField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "timezone":
                    return (
                      <EditableTimezoneField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "city":
                    return (
                      <EditableCityField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "file":
                    return (
                      <EditableFileField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "contract":
                    return (
                      <EditableContractField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "list":
                    return (
                      <EditableListField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  case "custom":
                    return (
                      <EditableCustomComponentField
                        field={formField as any}
                        {...commonProps}
                      />
                    );
                  default:
                    return null;
                }
              })()
            : (() => {
                const block = field as DisplayBlock;
                switch (block.kind) {
                  case "header":
                    return (
                      <EditableHeaderBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "text":
                    return (
                      <EditableTextBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "label":
                    return (
                      <EditableLabelBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "divider":
                    return (
                      <EditableDividerBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "spacer":
                    return (
                      <EditableSpacerBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "html":
                    return (
                      <EditableHtmlBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "image":
                    return (
                      <EditableImageBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "video":
                    return (
                      <EditableVideoBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "quote":
                    return (
                      <EditableQuoteBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "biglink":
                    return (
                      <EditableBigLinkBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "copytext":
                    return (
                      <EditableCopyTextBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "previousAnswer":
                    return (
                      <EditablePreviousAnswerBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "userLocation":
                    return (
                      <EditableUserLocationBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  case "chatTranscript":
                    return (
                      <EditableChatTranscriptBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  default:
                    console.error(
                      `Unknown block kind: ${block satisfies never}`,
                    );
                    return null;
                }
              })()}
        </div>

        {/* Insertion bar after */}
        {showInsertionBar && dropPosition === "after" && (
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <CustomValidatorDraftsContext.Provider value={customValidatorDraftContext}>
      {conflict && (
        <FormConflictModal
          base={conflict.base}
          mine={conflict.mine}
          theirs={conflict.theirs}
          saving={isSaving}
          onMerge={handleMerge}
          onKeepMine={handleKeepMine}
          onTakeTheirs={handleTakeTheirs}
          onCopyMine={handleCopyMine}
          onCancel={closeConflict}
        />
      )}
      <div className="flex h-[calc(100vh-40px)] bg-zinc-50">
        {!isPreviewMode && activeEditor === "form" && (
          <ElementSelect
            onAddField={addField}
            onAddDisplayBlock={addDisplayBlock}
            onCopyExisting={() => {
              setActiveSearchIndex(null);
              setSearchQuery("");
              setSearchResults([]);
              setCopyPickerIndex(currentPage.fields.length);
            }}
            displayOnly={displayOnly}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-end gap-4 flex-wrap xl:flex-nowrap">
              <div className="flex items-center space-x-2">
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
                </div>
              )}
            </div>

            {/* Page tabs - only show in edit mode */}
            {!isPreviewMode && !displayOnly && activeEditor === "form" && (
              <div
                className="flex space-x-1 mt-4 items-center"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();

                  if (
                    draggedPageIndex === null ||
                    pageDropPosition === null ||
                    dragOverPageIndex === null
                  ) {
                    handlePageDragEnd();
                    return;
                  }

                  // Use the last known drop position and target
                  const dropIndex = dragOverPageIndex;
                  let insertionIndex = dropIndex;
                  if (pageDropPosition === "after") {
                    insertionIndex = dropIndex + 1;
                  }

                  if (draggedPageIndex < insertionIndex) {
                    insertionIndex -= 1;
                  }

                  if (draggedPageIndex === insertionIndex) {
                    handlePageDragEnd();
                    return;
                  }

                  const newPages = [...schema.pages];
                  const [draggedPage] = newPages.splice(draggedPageIndex, 1);
                  newPages.splice(insertionIndex, 0, draggedPage);

                  let newSelectedPageIndex = selectedPageIndex;
                  if (selectedPageIndex === draggedPageIndex) {
                    newSelectedPageIndex = insertionIndex;
                  } else if (
                    selectedPageIndex > draggedPageIndex &&
                    selectedPageIndex <= insertionIndex
                  ) {
                    newSelectedPageIndex = selectedPageIndex - 1;
                  } else if (
                    selectedPageIndex < draggedPageIndex &&
                    selectedPageIndex >= insertionIndex
                  ) {
                    newSelectedPageIndex = selectedPageIndex + 1;
                  }

                  updateSchema({
                    ...schema,
                    pages: newPages,
                  });

                  setSelectedPageIndex(newSelectedPageIndex);
                  handlePageDragEnd();
                }}
              >
                {schema.pages.map((page, index) => {
                  const isDragging = draggedPageIndex === index;
                  const showInsertionBar =
                    dragOverPageIndex === index &&
                    pageDropPosition &&
                    !isDragging;

                  return (
                    <div key={page.id} className="relative">
                      {/* Insertion bar before */}
                      {showInsertionBar && pageDropPosition === "before" && (
                        <div className="absolute -left-0.5 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full z-10">
                          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}

                      <div
                        draggable
                        onDragStart={handlePageDragStart(index)}
                        onDragEnd={handlePageDragEnd}
                        onDragOver={handlePageDragOver(index)}
                        onDrop={handlePageDrop(index)}
                        className={cn(
                          "flex items-center rounded-md text-sm font-medium cursor-move pr-2 transition-all border",
                          selectedPageIndex === index
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent",
                          isDragging && "opacity-50 scale-95",
                        )}
                      >
                        {/* Drag handle */}
                        <div
                          className="px-2 py-2 text-gray-400 hover:text-gray-600 cursor-move"
                          title="Drag to reorder"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 6L6 10l4 4 4-4-4-4zM8 12l2-2 2 2H8z" />
                            <path d="M7 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 16a1 1 0 100 2h6a1 1 0 100-2H7z" />
                          </svg>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedPageIndex(index)}
                          className="py-2 flex-1 text-left pr-2"
                        >
                          {page.title}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyPage(index);
                          }}
                          className="py-2 px-1 text-gray-400 hover:text-blue-600"
                          title="Copy page"
                          aria-label={`Copy ${page.title || "page"}`}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        {schema.pages.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePage(index);
                            }}
                            className="py-2 text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Insertion bar after */}
                      {showInsertionBar && pageDropPosition === "after" && (
                        <div className="absolute -right-0.5 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full z-10">
                          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div
                  onClick={addPage}
                  color={ButtonColor.White}
                  className="p-1 !h-6 !w-6 rounded-full hover:bg-gray-200 flex items-center justify-center cursor-pointer"
                >
                  <p className="-mt-px text-zinc-700">+</p>
                </div>
              </div>
            )}
          </div>

          {/* Loading/Success/Error Messages */}
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
            ref={contentScrollRef}
            className="flex-1 p-6 overflow-y-auto min-h-0"
          >
            {activeEditor === "shareable" ? (
              <ShareableTextBuilder
                schema={schema}
                onSchemaChange={updateSchema}
              />
            ) : activeEditor === "outputs" ? (
              <OutputBuilder schema={schema} onSchemaChange={updateSchema} />
            ) : activeEditor === "aggregates" ? (
              <AggregateBuilder schema={schema} onSchemaChange={updateSchema} />
            ) : isPreviewMode && displayOnly ? (
              <div className="max-w-3xl mx-auto p-6">
                <DisplayOnlyPreview schema={schema} title={displayOnlyTitle} />
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
                  id={0}
                  formSnapshotId={null}
                  actionId={0}
                  form={schema}
                  onSubmit={null}
                  renderFormAsCompleted={false}
                  userId={resolvedPreviewUserId}
                  user={resolvedPreviewUser}
                  adminPreviewUserId={resolvedPreviewUserId}
                  initialPageIndex={selectedPageIndex}
                />
              </div>
            ) : (
              <div
                className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 p-6 mb-8"
                onClick={handleClickOutside}
              >
                {!displayOnly && (
                  <div className="mb-6">
                    <input
                      type="text"
                      value={currentPage.title || ""}
                      onChange={(e) =>
                        updateSchema({
                          ...schema,
                          pages: schema.pages.map((page, idx) =>
                            idx === selectedPageIndex
                              ? { ...page, title: e.target.value }
                              : page,
                          ),
                        })
                      }
                      className="text-lg font-medium w-full border-none outline-none"
                      placeholder="Page title"
                    />
                    {currentPage.description && (
                      <p className="text-gray-600 mt-1">
                        {currentPage.description}
                      </p>
                    )}
                    <div className="mt-3">
                      <label className="flex cursor-pointer items-center text-xs text-gray-700">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={showPageVisibilityControl}
                          onChange={(event) =>
                            handlePageVisibilityToggle(event.target.checked)
                          }
                        />
                        Use conditional visibility for this page
                      </label>
                      {showPageVisibilityControl && (
                        <div className="mt-2">
                          {selectedPageIndex === 0 && (
                            <p className="mb-2 text-xs text-amber-600">
                              Conditions on the first page can only reference
                              other forms or validators, since no fields have
                              been answered yet.
                            </p>
                          )}
                          <ConditionalVisibility
                            key={currentPage.id}
                            field={currentPage}
                            previousFields={pagePreviousFields}
                            onChange={updateCurrentPageVisibility}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <PerViewerOptions allowed={!displayOnly}>
                  <div className="space-y-4">
                    {currentPage.fields.length === 0 && (
                      <InsertPoint insertIndex={0} />
                    )}

                    {currentPage.fields.map((field, index) => (
                      <div key={field.id || index}>
                        {index > 0 && <InsertPoint insertIndex={index} />}
                        {index === 0 && <InsertPoint insertIndex={0} />}

                        {renderField(field, index)}

                        {index === currentPage.fields.length - 1 && (
                          <InsertPoint insertIndex={index + 1} />
                        )}
                      </div>
                    ))}

                    {draggedItem && currentPage.fields.length > 0 && (
                      <div
                        className="relative h-4 -mt-2"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverIndex(currentPage.fields.length);
                          setDropPosition("before");
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            !draggedItem ||
                            draggedItem.pageIndex !== selectedPageIndex
                          )
                            return;

                          const { index: dragIndex } = draggedItem;
                          const insertionIndex =
                            currentPage.fields.length -
                            (dragIndex < currentPage.fields.length ? 1 : 0);

                          if (dragIndex === insertionIndex) {
                            setDraggedItem(null);
                            setDragOverIndex(null);
                            setDropPosition(null);
                            return;
                          }

                          const currentFields = [...currentPage.fields];
                          const [draggedField] = currentFields.splice(
                            dragIndex,
                            1,
                          );
                          currentFields.push(draggedField);

                          updateSchema({
                            ...schema,
                            pages: schema.pages.map((page, idx) =>
                              idx === selectedPageIndex
                                ? { ...page, fields: currentFields }
                                : page,
                            ),
                          });

                          setDraggedItem(null);
                          setDragOverIndex(null);
                          setDropPosition(null);
                        }}
                      >
                        {dragOverIndex === currentPage.fields.length && (
                          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
                            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentPage.fields.length === 0 && (
                      <div
                        className="text-center py-12 text-gray-500 relative"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverIndex(0);
                          setDropPosition("before");
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            !draggedItem ||
                            draggedItem.pageIndex !== selectedPageIndex
                          )
                            return;

                          setDraggedItem(null);
                          setDragOverIndex(null);
                          setDropPosition(null);
                        }}
                      >
                        {draggedItem && dragOverIndex === 0 && (
                          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
                            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                        <p>
                          No fields added yet. Use the sidebar to add fields and
                          display blocks.
                        </p>
                      </div>
                    )}
                  </div>
                </PerViewerOptions>
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomValidatorDraftsContext.Provider>
  );
}
