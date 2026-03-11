/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  tasksCreateForm,
  tasksCreateCustomValidator,
  tasksGetForm,
  tasksUpdateForm,
  userList,
} from "@alliance/shared/client";
import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/shared/forms/display-blocks";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import LargeGeneralUpdateCard from "@alliance/sharedweb/ui/LargeGeneralUpdateCard";
import type {
  AnyField,
  Condition,
  FieldKind,
  FormSchema,
  MultiSelectField,
  Page,
  VisibleIfFormula,
} from "@alliance/shared/forms/formschema";
import type { UserDto } from "@alliance/shared/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewAsUserBar } from "./PreviewAsUserBar";
import {
  EditableBigLinkBlock,
  EditableDividerBlock,
  EditableHeaderBlock,
  EditableHtmlBlock,
  EditableImageBlock,
  EditableVideoBlock,
  EditableLabelBlock,
  EditableSpacerBlock,
  EditableTextBlock,
  EditablePreviousAnswerBlock,
} from "./display-blocks";
import { ElementSelect } from "./ElementSelect";
import {
  EditableCheckboxField,
  EditableDateField,
  EditableEmailField,
  EditableFileField,
  EditableMultiSelectField,
  EditableNumberField,
  EditablePhoneField,
  EditableRadioField,
  EditableSelectField,
  EditableTimeField,
  EditableTimezoneField,
  EditableCityField,
  EditableContractField,
  EditableListField,
  EditableTextField,
  EditableTextareaField,
  EditableCustomComponentField,
  EditableRangeField,
} from "./form-fields";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useBeforeUnload, useBlocker, useSearchParams } from "react-router";
import { EditableQuoteBlock } from "./display-blocks/EditableQuoteBlock";
import { customComponentRegistry } from "@alliance/sharedweb/forms/components";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { OutputBuilder } from "./OutputBuilder";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  CustomValidatorDraft,
  CustomValidatorDraftsContext,
  isDraftValidatorId,
} from "./form-fields/customValidatorDrafts";
import { cn } from "@alliance/shared/styles/util";

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
  date: "Date Field",
  time: "Time Field",
  timezone: "Timezone Field",
  city: "City Field",
  file: "File Field",
  contract: "Contract Field",
  list: "List Field",
  custom: "Custom Component Field",
} as const satisfies Record<Exclude<FieldKind, "text">, string>;

const BLOCK_NAMES = {
  header: "Header Block",
  "text-block": "Text Block",
  label: "Label Block",
  divider: "Divider Block",
  spacer: "Spacer Block",
  html: "HTML Block",
  image: "Image Block",
  video: "Video Block",
  quote: "Quote Block",
  biglink: "Big Link Block",
  previousAnswer: "Previous Answer Block",
} as const satisfies Record<
  Exclude<DisplayKind, "text"> | "text-block",
  string
>;

type AvailableElement =
  | {
      [K in keyof typeof FIELD_NAMES]: {
        id: K;
        name: (typeof FIELD_NAMES)[K];
        type: "field";
      };
    }[keyof typeof FIELD_NAMES]
  | {
      [K in keyof typeof BLOCK_NAMES]: {
        id: K;
        name: (typeof BLOCK_NAMES)[K];
        type: "block";
      };
    }[keyof typeof BLOCK_NAMES];

const AVAILABLE_ELEMENTS = [
  ...Object.entries(FIELD_NAMES).map(([id, name]) => ({
    id,
    name,
    type: "field",
  })),
  ...Object.entries(BLOCK_NAMES).map(([id, name]) => ({
    id,
    name,
    type: "block",
  })),
] as AvailableElement[];

interface FormBuilderProps {
  onSave?: (schema: FormSchema) => Promise<void>;
  initialSchema?: FormSchema;
  formId?: number;
  setFormId: (formId: number) => void;
  actionName?: string;
  generalUpdateName?: string;
}

const ensureOutputViews = (schema: FormSchema): FormSchema => ({
  ...schema,
  outputViews: schema.outputViews ?? [],
});

/** Remove deprecated visibleIf from all fields and blocks so only visibleIfFormula is persisted. */
function stripVisibleIfFromSchema(schema: FormSchema): FormSchema {
  const stripFromElement = (
    el: Record<string, unknown>
  ): Record<string, unknown> => {
    const out = { ...el };
    if ("visibleIf" in out) {
      delete out.visibleIf;
    }
    if (out.kind === "list" && Array.isArray(out.fields)) {
      out.fields = out.fields.map((f: unknown) =>
        typeof f === "object" && f !== null
          ? stripFromElement(f as Record<string, unknown>)
          : f
      );
    }
    return out;
  };

  return {
    ...schema,
    pages: (schema.pages ?? []).map((page) => ({
      ...page,
      fields: (page.fields ?? []).map((f) =>
        stripFromElement(f as unknown as Record<string, unknown>)
      ) as unknown as Page["fields"],
    })),
    outputViews: (schema.outputViews ?? []).map((view) => ({
      ...view,
      blocks: (view.blocks ?? []).map((b) =>
        stripFromElement(b as unknown as Record<string, unknown>)
      ) as unknown as typeof view.blocks,
    })),
  } as FormSchema;
}

const ensurePages = (schema: FormSchema): FormSchema => {
  const withOutputViews = ensureOutputViews(schema);
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
  previousOptions: MultiSelectField["options"] | undefined,
  nextOptions: MultiSelectField["options"] | undefined
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

const isSchemaFormField = (field: AnyField | DisplayBlock): field is AnyField =>
  "label" in field;

const mapConditionForOptionValue = (
  condition: Condition,
  controllerId: string,
  previousValue: string,
  nextValue: string
): { condition: Condition; updated: boolean } => {
  if (!("when" in condition) || condition.when !== controllerId) {
    return { condition, updated: false };
  }
  if (
    "includesOption" in condition &&
    condition.includesOption === previousValue
  ) {
    return {
      condition: { ...condition, includesOption: nextValue },
      updated: true,
    };
  }
  if ("equals" in condition && condition.equals === previousValue) {
    return { condition: { ...condition, equals: nextValue }, updated: true };
  }
  return { condition, updated: false };
};

const getUpdatedVisibilityConditions = (
  visibleIf: Condition[] | Condition | undefined,
  controllerId: string,
  previousValue: string,
  nextValue: string
): { changed: boolean; visibleIf?: Condition[] } => {
  if (!visibleIf) {
    return { changed: false };
  }

  const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
  let updated = false;
  const nextConditions = conditions.map((c) => {
    const { condition, updated: u } = mapConditionForOptionValue(
      c,
      controllerId,
      previousValue,
      nextValue
    );
    if (u) updated = true;
    return condition;
  });

  if (!updated) {
    return { changed: false };
  }

  return {
    changed: true,
    visibleIf: nextConditions,
  };
};

const getUpdatedVisibilityFormula = (
  visibleIfFormula: VisibleIfFormula | undefined,
  controllerId: string,
  previousValue: string,
  nextValue: string
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
      nextValue
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
  startIndex: number
) => {
  let hasChanges = false;

  const nextFields = fields.map((candidate, idx) => {
    if (idx <= startIndex) {
      return candidate;
    }

    const visibleIf = candidate.visibleIf;
    const visibleIfFormula = candidate.visibleIfFormula;

    const result = getUpdatedVisibilityConditions(
      visibleIf,
      controllerId,
      previousValue,
      nextValue
    );
    const formulaResult = getUpdatedVisibilityFormula(
      visibleIfFormula,
      controllerId,
      previousValue,
      nextValue
    );

    if (!result.changed && !formulaResult.changed) {
      return candidate;
    }

    hasChanges = true;
    return {
      ...candidate,
      ...(result.changed && result.visibleIf != null
        ? { visibleIf: result.visibleIf }
        : {}),
      ...(formulaResult.changed && formulaResult.visibleIfFormula != null
        ? { visibleIfFormula: formulaResult.visibleIfFormula }
        : {}),
    };
  });

  return hasChanges ? nextFields : fields;
};

export function FormBuilder({
  onSave,
  initialSchema,
  formId,
  setFormId,
  actionName,
  generalUpdateName,
}: FormBuilderProps) {
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
        };

  const [schema, setSchema] = useState<FormSchema>(buildInitialSchema);
  const [lastSavedSchemaJSON, setLastSavedSchemaJSON] = useState<string>(() =>
    JSON.stringify(buildInitialSchema())
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const activeEditor = searchParams.get("editor") ?? "form";

  const setActiveEditor = useCallback(
    (editor: "form" | "outputs") => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("editor", editor);
        return next;
      });
    },
    [setSearchParams]
  );

  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [draggedItem, setDraggedItem] = useState<{
    index: number;
    pageIndex: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null
  );

  // Page drag and drop state
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(
    null
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
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<AvailableElement>>(
    []
  );
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
    []
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
    [createDraftId, customValidatorDrafts, removeDraft, setDraft]
  );
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const currentPage = schema.pages[selectedPageIndex] ??
    schema.pages?.[0] ?? { id: "page-1", title: "Page 1", fields: [] };
  const resolvedPreviewUser = useMemo(() => {
    if (previewUserId === "preview") {
      return FORM_BUILDER_PREVIEW_USER;
    }
    const match = previewUsers.find(
      (candidate) => String(candidate.id) === previewUserId
    );
    return match ?? FORM_BUILDER_PREVIEW_USER;
  }, [previewUserId, previewUsers]);
  const resolvedPreviewUserId =
    previewUserId === "preview"
      ? "preview"
      : resolvedPreviewUser?.id ?? "preview";

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  useEffect(() => {
    if (Object.keys(customValidatorDrafts).length === 0) {
      return;
    }
    const activeDraftIds = new Set<number>();

    const collectFromConditions = (visibleIf?: Condition[] | Condition) => {
      if (!visibleIf) return;
      const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
      conditions.forEach((condition) => {
        if (
          "validatorId" in condition &&
          isDraftValidatorId(condition.validatorId)
        ) {
          activeDraftIds.add(condition.validatorId);
        }
      });
    };

    const collectFromVisibleIfFormula = (visibleIfFormula?: {
      conditions: Record<string, Condition>;
    }) => {
      if (!visibleIfFormula?.conditions) return;
      Object.values(visibleIfFormula.conditions).forEach((condition) => {
        if (
          "validatorId" in condition &&
          isDraftValidatorId(condition.validatorId)
        ) {
          activeDraftIds.add(condition.validatorId);
        }
      });
    };

    schema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (isSchemaFormField(field)) {
          if (isDraftValidatorId(field.customValidatorId)) {
            activeDraftIds.add(field.customValidatorId);
          }
        }
        collectFromConditions(field.visibleIf);
        collectFromVisibleIfFormula(field.visibleIfFormula);
      });
    });

    schema.outputViews.forEach((view) => {
      view.blocks.forEach((block) => {
        collectFromConditions(block.visibleIf);
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
      const filtered = AVAILABLE_ELEMENTS.filter((element) =>
        element.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearchSelect = (
    element: AvailableElement,
    insertIndex: number
  ) => {
    if (element.type === "field") {
      addField(element.id as FieldKind, insertIndex);
    } else {
      // Map text-block back to text for DisplayKind
      const blockKind = element.id === "text-block" ? "text" : element.id;
      addDisplayBlock(blockKind, insertIndex);
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
  };

  // Load form data when formId changes
  useEffect(() => {
    if (generalUpdateName || !formId || initialSchema) return;
    setIsLoading(true);
    setLoadError(null);

    tasksGetForm({ path: { id: formId } })
      .then((response) => {
        if (response.data) {
          // Convert the form entity back to FormSchema
          const form = response.data as any;
          if (form.schema) {
            const nextSchema = ensurePages(
              form.schema as unknown as FormSchema
            );
            setSchema(nextSchema);
            setLastSavedSchemaJSON(JSON.stringify(nextSchema));
            setHasUnsavedChanges(false);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load form:", error);
        setLoadError(
          error instanceof Error ? error.message : "Failed to load form"
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [formId, initialSchema, generalUpdateName]);

  const addField = (kind: FieldKind, insertIndex?: number) => {
    const fieldId = `field-${Date.now()}`;
    let newField: AnyField;

    switch (kind) {
      case "text":
        newField = {
          id: fieldId,
          kind: "text",
          label: "Text Field",
          required: false,
        };
        break;
      case "textarea":
        newField = {
          id: fieldId,
          kind: "textarea",
          label: "Textarea Field",
          required: false,
          rows: 3,
        };
        break;
      case "email":
        newField = {
          id: fieldId,
          kind: "email",
          label: "Email Field",
          required: false,
        };
        break;
      case "phone":
        newField = {
          id: fieldId,
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
          kind: "number",
          label: "Number Field",
          required: false,
        };
        break;
      case "range":
        newField = {
          id: fieldId,
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
          kind: "checkbox",
          label: "Checkbox Field",
          required: false,
        };
        break;
      case "radio":
        newField = {
          id: fieldId,
          kind: "radio",
          label: "Radio Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "select":
        newField = {
          id: fieldId,
          kind: "select",
          label: "Select Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "multiselect":
        newField = {
          id: fieldId,
          kind: "multiselect",
          label: "Multi-Select Field",
          required: false,
          options: [{ label: "Option 1", value: "option1" }],
        };
        break;
      case "date":
        newField = {
          id: fieldId,
          kind: "date",
          label: "Date Field",
          required: false,
        };
        break;
      case "time":
        newField = {
          id: fieldId,
          kind: "time",
          label: "Time Field",
          required: false,
          autoExtractUserData: false,
        };
        break;
      case "timezone":
        newField = {
          id: fieldId,
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
          kind: "file",
          label: "File Field",
          required: false,
        };
        break;
      case "contract":
        newField = {
          id: fieldId,
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
          kind: "list",
          label: "List Field",
          fields: [],
          defaultNumber: 0,
          min: 0,
          required: false,
        };
        break;
      case "custom": {
        const defaultComponent = customComponentRegistry[0];
        newField = {
          id: fieldId,
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
        idx === selectedPageIndex ? { ...page, fields: newFields } : page
      ),
    });
  };

  const addDisplayBlock = (kind: DisplayKind, insertIndex?: number) => {
    const blockId = `block-${Date.now()}`;
    let newBlock: DisplayBlock;

    switch (kind) {
      case "header":
        newBlock = {
          kind: "header",
          id: blockId,
          text: "Header Text",
          level: 2,
        };
        break;
      case "text":
        newBlock = {
          kind: "text",
          id: blockId,
          text: "Text content",
        };
        break;
      case "label":
        newBlock = { kind: "label", id: blockId, text: "Label text" };
        break;
      case "divider":
        newBlock = { kind: "divider", id: blockId, thickness: "thin" };
        break;
      case "spacer":
        newBlock = { kind: "spacer", id: blockId, size: "md" };
        break;
      case "html":
        newBlock = {
          kind: "html",
          id: blockId,
          html: "<p>Custom HTML content</p>",
        };
        break;
      case "image":
        newBlock = {
          kind: "image",
          id: blockId,
          alt: "Image",
          src: "https://via.placeholder.com/300x200",
        };
        break;
      case "video":
        newBlock = {
          kind: "video",
          id: blockId,
          src: "",
        };
        break;
      case "quote":
        newBlock = { kind: "quote", id: blockId, text: "body text" };
        break;
      case "biglink":
        newBlock = {
          kind: "biglink",
          id: blockId,
          text: "Link title",
          url: "/",
        };
        break;
      case "previousAnswer":
        newBlock = {
          kind: "previousAnswer",
          id: blockId,
          sourceFormId: 0,
          sourceFieldId: "",
          title: "",
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
        idx === selectedPageIndex ? { ...page, fields: newFields } : page
      ),
    });
  };

  const updateSchema = (newSchema: FormSchema) => {
    setSchema(ensureOutputViews(newSchema));
  };

  const resolveCustomValidatorDrafts = useCallback(
    async (schemaToSave: FormSchema) => {
      const draftIds = new Set<number>();

      const collectFromConditions = (visibleIf?: Condition[] | Condition) => {
        if (!visibleIf) return;
        const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
        conditions.forEach((condition) => {
          if (
            "validatorId" in condition &&
            isDraftValidatorId(condition.validatorId)
          ) {
            draftIds.add(condition.validatorId);
          }
        });
      };

      const collectFromVisibleIfFormula = (visibleIfFormula?: {
        conditions: Record<string, Condition>;
      }) => {
        if (!visibleIfFormula?.conditions) return;
        Object.values(visibleIfFormula.conditions).forEach((condition) => {
          if (
            "validatorId" in condition &&
            isDraftValidatorId(condition.validatorId)
          ) {
            draftIds.add(condition.validatorId);
          }
        });
      };

      schemaToSave.pages.forEach((page) => {
        page.fields.forEach((field) => {
          if (
            isSchemaFormField(field) &&
            isDraftValidatorId(field.customValidatorId)
          ) {
            draftIds.add(field.customValidatorId);
          }
          collectFromConditions(field.visibleIf);
          collectFromVisibleIfFormula(field.visibleIfFormula);
        });
      });

      schemaToSave.outputViews.forEach((view) => {
        view.blocks.forEach((block) => {
          collectFromConditions(block.visibleIf);
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
          const response = await tasksCreateCustomValidator({
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
        })
      );

      const mapCondition = (condition: Condition): Condition => {
        if (
          "validatorId" in condition &&
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

      const mapVisibleIf = (
        visibleIf?: Condition[] | Condition
      ): Condition[] | undefined => {
        if (!visibleIf) return undefined;
        const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
        return conditions.map(mapCondition);
      };

      const mapVisibleIfFormula = (
        visibleIfFormula?: VisibleIfFormula
      ): VisibleIfFormula | undefined => {
        if (!visibleIfFormula?.conditions) return visibleIfFormula;
        const nextConditions: Record<string, Condition> = {};
        for (const [name, cond] of Object.entries(
          visibleIfFormula.conditions
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
          fields: page.fields.map((field) => {
            const nextVisibleIf = mapVisibleIf(field.visibleIf);
            const nextVisibleIfFormula = mapVisibleIfFormula(
              field.visibleIfFormula
            );
            if (isSchemaFormField(field)) {
              const nextValidatorId = isDraftValidatorId(
                field.customValidatorId
              )
                ? resolvedIds.get(field.customValidatorId) ??
                  field.customValidatorId
                : field.customValidatorId;
              return {
                ...field,
                customValidatorId: nextValidatorId,
                visibleIf: nextVisibleIf,
                visibleIfFormula: nextVisibleIfFormula,
              };
            }
            return {
              ...field,
              visibleIf: nextVisibleIf,
              visibleIfFormula: nextVisibleIfFormula,
            };
          }),
        })),
        outputViews: schemaToSave.outputViews.map((view) => ({
          ...view,
          blocks: view.blocks.map((block) => ({
            ...block,
            visibleIf: mapVisibleIf(block.visibleIf),
            visibleIfFormula: mapVisibleIfFormula(block.visibleIfFormula),
          })),
        })),
      };

      return {
        schema: nextSchema,
        resolvedDraftIds: [...resolvedIds.keys()],
      };
    },
    [customValidatorDrafts]
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
      [hasUnsavedChanges]
    )
  );

  const navigationBlocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (navigationBlocker.state === "blocked") {
      const confirmExit = window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?"
      );

      if (confirmExit) {
        navigationBlocker.proceed?.();
      } else {
        navigationBlocker.reset?.();
      }
    }
  }, [navigationBlocker]);

  useEffect(() => {
    if (activeEditor === "outputs" && isPreviewMode) {
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
      const response = await userList();
      setPreviewUsers(response.data ?? []);
    } catch (error) {
      console.error("Failed to load users for preview", error);
      setPreviewUserError(
        error instanceof Error ? error.message : "Could not load users"
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

  const addPage = () => {
    const newPage: Page = {
      id: `page-${schema.pages.length + 1}`,
      title: `Page ${schema.pages.length + 1}`,
      fields: [],
    };
    updateSchema({
      ...schema,
      pages: [...schema.pages, newPage],
    });
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
      const { schema: schemaForSave, resolvedDraftIds } =
        await resolveCustomValidatorDrafts(schema);
      if (resolvedDraftIds.length > 0) {
        setSchema(schemaForSave);
      }

      const schemaToPersist = stripVisibleIfFromSchema(schemaForSave);

      // displayBlocksOnly mode: save via onSave only (e.g. general update schema)
      if (generalUpdateName && onSave) {
        await onSave(schemaToPersist);
        setLastSavedSchemaJSON(JSON.stringify(schemaToPersist));
        setHasUnsavedChanges(false);
        showSuccessToast("Saved successfully");
        return;
      }

      let response;

      if (formId) {
        // Update existing form
        response = await tasksUpdateForm({
          path: { formId },
          body: {
            title: schemaToPersist.title,
            schema: schemaToPersist as unknown as Record<string, unknown>,
          },
        });
      } else {
        // Create new form
        response = await tasksCreateForm({
          body: {
            title: schemaToPersist.title,
            schema: schemaToPersist as unknown as Record<string, unknown>,
          },
        });
      }

      if (response.response.ok && response.data) {
        setFormId(response.data.id);
        setLastSavedSchemaJSON(JSON.stringify(schemaToPersist));
        setHasUnsavedChanges(false);
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

      // Call the optional onSave callback if provided
      if (onSave) {
        await onSave(schemaToPersist);
      }

      // Clear success message after 3 seconds
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
    generalUpdateName,
    formId,
    onSave,
    resolveCustomValidatorDrafts,
    schema,
    setFormId,
    showErrorToast,
    showSuccessToast,
  ]);

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
        idx === selectedPageIndex ? { ...page, fields: currentFields } : page
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
                          element.type === "field"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        )}
                      >
                        {element.type === "field" ? "Field" : "Block"}
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

  const renderField = (field: AnyField | DisplayBlock, index: number) => {
    const updateField = (updates: Partial<AnyField | DisplayBlock>) => {
      const optionValueChange =
        (field as AnyField).kind === "multiselect" &&
        "options" in updates &&
        updates.options
          ? findSingleOptionValueChange(
              (field as MultiSelectField).options,
              updates.options as MultiSelectField["options"]
            )
          : null;

      const nextPages = schema.pages.map((page, pageIndex) => {
        if (pageIndex === selectedPageIndex) {
          const updatedFields = page.fields.map((f, i) =>
            i === index ? ({ ...f, ...updates } as AnyField | DisplayBlock) : f
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
              index
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
              -1
            );

          if (fieldsWithUpdatedConditions !== page.fields) {
            return { ...page, fields: fieldsWithUpdatedConditions };
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
            : page
        ),
      });
    };

    const isDragging =
      draggedItem?.index === index &&
      draggedItem?.pageIndex === selectedPageIndex;
    const showInsertionBar =
      dragOverIndex === index && dropPosition && !isDragging;

    // Build previous answer fields for conditional visibility controls
    const previousFields = currentPage.fields
      .slice(0, index)
      .filter(
        (f): f is AnyField =>
          (f as any)?.kind && (f as any)?.label !== undefined
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
          {/* Check if it's a form field (has 'label' property) vs display block */}
          {"label" in field
            ? (() => {
                const formField = field as AnyField;
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
                  case "previousAnswer":
                    return (
                      <EditablePreviousAnswerBlock
                        block={block as any}
                        {...commonProps}
                      />
                    );
                  default:
                    console.error(
                      `Unknown block kind: ${block satisfies never}`
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
      <div className="flex h-[calc(100vh-40px)] bg-zinc-50">
        {!isPreviewMode && activeEditor === "form" && (
          <ElementSelect
            onAddField={addField}
            onAddDisplayBlock={addDisplayBlock}
            displayBlocksOnly={!!generalUpdateName}
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
              {!generalUpdateName && (
                <div className="inline-flex rounded-md bg-gray-200 p-0.5 text-sm font-medium text-gray-600">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-2 rounded-md text-nowrap",
                      activeEditor === "form"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-600"
                    )}
                    onClick={() => setActiveEditor("form")}
                  >
                    Form builder
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1 rounded-md text-nowrap",
                      activeEditor === "outputs"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-600"
                    )}
                    onClick={() => setActiveEditor("outputs")}
                  >
                    Output views
                  </button>
                </div>
              )}
            </div>

            {/* Page tabs - only show in edit mode */}
            {!isPreviewMode && activeEditor === "form" && (
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
                          isDragging && "opacity-50 scale-95"
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
                          onClick={() => setSelectedPageIndex(index)}
                          className="py-2 flex-1 text-left pr-2"
                        >
                          {page.title}
                        </button>

                        {schema.pages.length > 1 && (
                          <button
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
            {activeEditor === "outputs" && !generalUpdateName ? (
              <OutputBuilder schema={schema} onSchemaChange={updateSchema} />
            ) : isPreviewMode && generalUpdateName ? (
              <div className="max-w-3xl mx-auto bg-white p-6">
                <PreviewAsUserBar
                  previewUserId={previewUserId}
                  setPreviewUserId={setPreviewUserId}
                  previewUsers={previewUsers}
                  isLoadingPreviewUsers={isLoadingPreviewUsers}
                  previewUserError={previewUserError}
                />
                <LargeGeneralUpdateCard
                  title={generalUpdateName}
                  schema={schema as unknown as Record<string, unknown>}
                  userId={resolvedPreviewUserId}
                  user={resolvedPreviewUser}
                  onDismiss={() => {}}
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
                  id={0}
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
                            : page
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
                </div>

                <div className="space-y-4">
                  {/* Search bar at the beginning if no fields */}
                  {currentPage.fields.length === 0 && (
                    <InlineSearch insertIndex={0} />
                  )}

                  {currentPage.fields.map((field, index) => (
                    <div key={field.id || index}>
                      {/* Search bar before each element (except first) */}
                      {index > 0 && <InlineSearch insertIndex={index} />}
                      {/* First element gets search at beginning */}
                      {index === 0 && <InlineSearch insertIndex={0} />}

                      {renderField(field, index)}

                      {/* Search bar after last element */}
                      {index === currentPage.fields.length - 1 && (
                        <InlineSearch insertIndex={index + 1} />
                      )}
                    </div>
                  ))}

                  {/* Drop zone at the end of the list */}
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
                          1
                        );
                        currentFields.push(draggedField);

                        updateSchema({
                          ...schema,
                          pages: schema.pages.map((page, idx) =>
                            idx === selectedPageIndex
                              ? { ...page, fields: currentFields }
                              : page
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

                        // This shouldn't happen since we're on an empty page, but handle it gracefully
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
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomValidatorDraftsContext.Provider>
  );
}
