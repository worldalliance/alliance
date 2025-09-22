/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  tasksCreateForm,
  tasksGetForm,
  tasksUpdateForm,
} from "@alliance/shared/client";
import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/shared/forms/display-blocks";
import FormRenderer from "@alliance/shared/forms/FormRenderer";
import type {
  AnyField,
  FieldKind,
  FormSchema,
  Page,
} from "@alliance/shared/forms/formschema";
import { useEffect, useMemo, useState } from "react";
import {
  EditableDividerBlock,
  EditableHeaderBlock,
  EditableHtmlBlock,
  EditableImageBlock,
  EditableLabelBlock,
  EditableSpacerBlock,
  EditableTextBlock,
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
  EditableTextField,
  EditableTextareaField,
} from "./form-fields";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useNavigate } from "react-router";

interface FormBuilderProps {
  onSave?: (schema: FormSchema) => void;
  initialSchema?: FormSchema;
  formId?: string;
}

export function FormBuilder({
  onSave,
  initialSchema,
  formId: propFormId,
}: FormBuilderProps) {
  const [formId, setFormId] = useState(propFormId);

  const [schema, setSchema] = useState<FormSchema>(
    initialSchema || {
      title: "Untitled Form",
      description: "",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          fields: [],
        },
      ],
      submit: { label: "Complete" },
    }
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; type: "field" | "block" }>
  >([]);

  const currentPage = schema.pages[selectedPageIndex];

  const navigate = useNavigate();

  // Available elements for search
  const availableElements = useMemo(
    () => [
      { id: "text", name: "Text Field", type: "field" as const },
      { id: "textarea", name: "Textarea Field", type: "field" as const },
      { id: "email", name: "Email Field", type: "field" as const },
      { id: "phone", name: "Phone Field", type: "field" as const },
      { id: "number", name: "Number Field", type: "field" as const },
      { id: "checkbox", name: "Checkbox Field", type: "field" as const },
      { id: "radio", name: "Radio Field", type: "field" as const },
      { id: "select", name: "Select Field", type: "field" as const },
      { id: "multiselect", name: "Multi-select Field", type: "field" as const },
      { id: "date", name: "Date Field", type: "field" as const },
      { id: "file", name: "File Field", type: "field" as const },
      { id: "header", name: "Header Block", type: "block" as const },
      { id: "text-block", name: "Text Block", type: "block" as const },
      { id: "label", name: "Label Block", type: "block" as const },
      { id: "divider", name: "Divider Block", type: "block" as const },
      { id: "spacer", name: "Spacer Block", type: "block" as const },
      { id: "html", name: "HTML Block", type: "block" as const },
      { id: "image", name: "Image Block", type: "block" as const },
    ],
    []
  );

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = availableElements.filter((element) =>
        element.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, availableElements]);

  const handleSearchSelect = (
    element: (typeof availableElements)[0],
    insertIndex: number
  ) => {
    if (element.type === "field") {
      addField(element.id as FieldKind, insertIndex);
    } else {
      // Map text-block back to text for DisplayKind
      const blockKind = element.id === "text-block" ? "text" : element.id;
      addDisplayBlock(blockKind as DisplayKind, insertIndex);
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
    if (formId && !initialSchema) {
      setIsLoading(true);
      setLoadError(null);

      tasksGetForm({ path: { id: parseInt(formId) } })
        .then((response) => {
          if (response.data) {
            // Convert the form entity back to FormSchema
            const form = response.data as any;
            if (form.schema) {
              setSchema(form.schema as unknown as FormSchema);
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
    }
  }, [formId, initialSchema]);

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
      case "file":
        newField = {
          id: fieldId,
          kind: "file",
          label: "File Field",
          required: false,
        };
        break;
      default:
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
          markdown: false,
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
      default:
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
    setSchema(newSchema);
  };

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

  const handleSaveForm = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let response;

      if (formId) {
        // Update existing form
        response = await tasksUpdateForm({
          path: { formId },
          body: {
            title: schema.title,
            schema: schema as unknown as Record<string, unknown>,
          },
        });
      } else {
        // Create new form
        response = await tasksCreateForm({
          body: {
            title: schema.title,
            schema: schema as unknown as Record<string, unknown>,
          },
        });
      }

      if (response.response.ok) {
        setSaveSuccess(true);

        // If creating a new form, update the URL to include the new form ID
        if (!formId && response.data && (response.data as any).id) {
          const newFormId = (response.data as any).id;
          const newUrl = "/forms/" + newFormId;
          window.history.replaceState({}, "", newUrl);
          setFormId(newFormId);
        }
      } else {
        setSaveError("Could not save form");
      }

      // Call the optional onSave callback if provided
      if (onSave) {
        onSave(schema);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save form:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save form"
      );
    } finally {
      setIsSaving(false);
    }
  };

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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
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
                        className={`text-xs px-2 py-1 rounded-full ${
                          element.type === "field"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
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
      updateSchema({
        ...schema,
        pages: schema.pages.map((page, idx) =>
          idx === selectedPageIndex
            ? {
                ...page,
                fields: page.fields.map((f, i) =>
                  i === index
                    ? ({ ...f, ...updates } as AnyField | DisplayBlock)
                    : f
                ),
              }
            : page
        ),
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
                  case "file":
                    return (
                      <EditableFileField
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
                  default:
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
    <div className="flex h-[calc(100vh-40px)] bg-gray-50">
      {!isPreviewMode && (
        <ElementSelect
          onAddField={addField}
          onAddDisplayBlock={addDisplayBlock}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                Form Builder
              </h1>
              <input
                type="text"
                value={schema.title}
                onChange={(e) =>
                  updateSchema({ ...schema, title: e.target.value })
                }
                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Form title"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => navigate(`/forms/${formId}/responses`)}
                color={ButtonColor.Light}
              >
                View Responses
              </Button>
              <Button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                color={ButtonColor.Light}
              >
                {isPreviewMode ? "Edit Form" : "Preview Form"}
              </Button>
              {!isPreviewMode && (
                <Button onClick={addPage} color={ButtonColor.Light}>
                  Add Page
                </Button>
              )}
              <Button
                onClick={handleSaveForm}
                disabled={isSaving || isLoading}
                color={ButtonColor.Blue}
              >
                {isSaving ? "Saving..." : "Save Form"}
              </Button>
            </div>
          </div>

          {/* Page tabs - only show in edit mode */}
          {!isPreviewMode && (
            <div
              className="flex space-x-1 mt-4"
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
                      className={`flex items-center rounded-md text-sm font-medium cursor-move pr-2 transition-all border ${
                        selectedPageIndex === index
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent"
                      } ${isDragging ? "opacity-50 scale-95" : ""}`}
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
          {saveSuccess && (
            <div className="bg-green/20 text-green-700 px-4 py-3 mb-2 rounded-sm">
              <span className="block sm:inline">Form saved successfully!</span>
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

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {isPreviewMode ? (
            <FormRenderer
              id={0}
              form={schema}
              onSubmit={null}
              renderFormAsCompleted={false}
            />
          ) : (
            <div
              className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
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
                      const [draggedField] = currentFields.splice(dragIndex, 1);
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
  );
}
