import { useEffect, useMemo, useState } from "react";
import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/shared/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  FormValue,
  OutputBlock,
  OutputFieldBlock,
  OutputViewSchema,
} from "@alliance/shared/forms/formschema";
import OutputRenderer from "@alliance/sharedweb/forms/OutputRenderer";
import {
  EditableDividerBlock,
  EditableHeaderBlock,
  EditableHtmlBlock,
  EditableImageBlock,
  EditableLabelBlock,
  EditableSpacerBlock,
  EditableTextBlock,
} from "./display-blocks";
import { EditableQuoteBlock } from "./display-blocks/EditableQuoteBlock";
import { EditableOutputFieldBlock } from "./output-builder/EditableOutputFieldBlock";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";

const DISPLAY_BLOCK_KINDS: DisplayKind[] = [
  "header",
  "text",
  "label",
  "divider",
  "spacer",
  "html",
  "image",
  "quote",
];

const createDisplayBlock = (kind: DisplayKind): DisplayBlock => {
  const blockId = `block-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  switch (kind) {
    case "header":
      return { kind, id: blockId, text: "Header", level: 2 };
    case "text":
      return { kind, id: blockId, text: "Text content" };
    case "label":
      return { kind, id: blockId, text: "Label" };
    case "divider":
      return { kind, id: blockId, thickness: "thin" };
    case "spacer":
      return { kind, id: blockId, size: "md" };
    case "html":
      return { kind, id: blockId, html: "<p>Custom HTML</p>" };
    case "image":
      return {
        kind,
        id: blockId,
        alt: "Image",
        src: "https://via.placeholder.com/400x200",
      };
    case "quote":
      return { kind, id: blockId, text: "Quote text" };
    default:
      return { kind: "text", id: blockId, text: "Text content" };
  }
};

const collectOutputFields = (schema: FormSchema): AnyField[] => {
  const result: AnyField[] = [];
  schema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if ("kind" in field && (field as AnyField).label !== undefined) {
        const typedField = field as AnyField;
        if (typedField.output?.output) {
          result.push(typedField);
        }
      }
    });
  });
  return result;
};

const buildPreviewAnswers = (fields: AnyField[]): Record<string, FormValue> => {
  const answers: Record<string, FormValue> = {};
  fields.forEach((field) => {
    switch (field.kind) {
      case "checkbox":
        answers[field.id] = true;
        break;
      case "radio":
      case "select":
        answers[field.id] = field.options?.[0]?.value ?? field.label;
        break;
      case "multiselect":
        answers[field.id] = field.options
          ?.slice(0, 2)
          .map((option) => option.value) ?? [field.label];
        break;
      case "number":
        answers[field.id] = 42;
        break;
      case "date":
        answers[field.id] = "2024-01-01";
        break;
      case "time":
        answers[field.id] = "09:00";
        break;
      case "timezone":
        answers[field.id] = "America/Los_Angeles";
        break;
      case "city":
        answers[field.id] = {
          id: 1,
          name: "San Francisco",
          admin1: "California",
          countryCode: "US",
          countryName: "United States",
        };
        break;
      case "file":
        answers[field.id] = "uploaded/file.pdf";
        break;
      case "email":
        answers[field.id] = "user@example.com";
        break;
      case "phone":
        answers[field.id] = "(555) 010-1234";
        break;
      default:
        answers[field.id] = `${field.label} response`;
        break;
    }
  });
  return answers;
};

const buildNewView = (schema: FormSchema): OutputViewSchema => ({
  id: `output-view-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
  type: "default",
  title: `View ${((schema.outputViews ?? []).length || 0) + 1}`,
  description: "",
  blocks: [],
});

interface OutputBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

export function OutputBuilder({ schema, onSchemaChange }: OutputBuilderProps) {
  const [selectedViewId, setSelectedViewId] = useState<string | null>(
    () => schema.outputViews?.[0]?.id ?? null
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null
  );
  const outputFields = useMemo(() => collectOutputFields(schema), [schema]);
  const previewAnswers = useMemo(
    () => buildPreviewAnswers(outputFields),
    [outputFields]
  );

  useEffect(() => {
    if (!schema.outputViews || schema.outputViews.length === 0) {
      setSelectedViewId(null);
      return;
    }
    if (
      !selectedViewId ||
      !schema.outputViews.some((view) => view.id === selectedViewId)
    ) {
      setSelectedViewId(schema.outputViews[0].id);
    }
  }, [schema.outputViews, selectedViewId]);

  const selectedView: OutputViewSchema | null = useMemo(() => {
    if (!schema.outputViews || schema.outputViews.length === 0) {
      return null;
    }
    return (
      schema.outputViews.find((view) => view.id === selectedViewId) ??
      schema.outputViews[0]
    );
  }, [schema.outputViews, selectedViewId]);

  const updateViews = (views: OutputViewSchema[]) => {
    onSchemaChange({
      ...schema,
      outputViews: views,
    });
  };

  const updateSelectedView = (updates: Partial<OutputViewSchema>) => {
    if (!selectedView) return;
    const nextViews = (schema.outputViews ?? []).map((view) =>
      view.id === selectedView.id ? { ...view, ...updates } : view
    );
    updateViews(nextViews);
  };

  const updateBlockAtIndex = (index: number, updates: Partial<OutputBlock>) => {
    if (!selectedView) return;
    const nextBlocks = selectedView.blocks.map((block, idx) =>
      idx === index ? ({ ...block, ...updates } as OutputBlock) : block
    );
    updateSelectedView({ blocks: nextBlocks });
  };

  const removeBlockAtIndex = (index: number) => {
    if (!selectedView) return;
    const nextBlocks = selectedView.blocks.filter((_, idx) => idx !== index);
    updateSelectedView({ blocks: nextBlocks });
  };

  const addDisplayBlock = (kind: DisplayKind) => {
    const block = createDisplayBlock(kind);
    if (
      !schema.outputViews ||
      schema.outputViews.length === 0 ||
      !selectedView
    ) {
      const newView = {
        ...buildNewView(schema),
        blocks: [block],
      };
      const nextViews = [...(schema.outputViews ?? []), newView];
      updateViews(nextViews);
      setSelectedViewId(newView.id);
      return;
    }
    const nextViews = (schema.outputViews ?? []).map((view) =>
      view.id === selectedView.id
        ? { ...view, blocks: [...view.blocks, block] }
        : view
    );
    updateViews(nextViews);
  };

  const addOutputBlock = () => {
    if (!outputFields.length) {
      return;
    }
    const newBlock: OutputFieldBlock = {
      id: `output-field-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      fieldId: outputFields[0].id,
      showLabel: true,
      format: "field",
    };
    if (
      !schema.outputViews ||
      schema.outputViews.length === 0 ||
      !selectedView
    ) {
      const newView = {
        ...buildNewView(schema),
        blocks: [newBlock],
      };
      const nextViews = [...(schema.outputViews ?? []), newView];
      updateViews(nextViews);
      setSelectedViewId(newView.id);
      return;
    }
    const nextViews = (schema.outputViews ?? []).map((view) =>
      view.id === selectedView.id
        ? { ...view, blocks: [...view.blocks, newBlock] }
        : view
    );
    updateViews(nextViews);
  };

  const addView = () => {
    const newView = buildNewView(schema);
    const nextViews = [...(schema.outputViews ?? []), newView];
    updateViews(nextViews);
    setSelectedViewId(newView.id);
  };

  const removeView = (viewId: string) => {
    const nextViews = (schema.outputViews ?? []).filter(
      (view) => view.id !== viewId
    );
    updateViews(nextViews);
    if (selectedViewId === viewId) {
      setSelectedViewId(nextViews[0]?.id ?? null);
    }
  };

  const handleDragStart = (index: number) => (event: React.DragEvent) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleDragOver = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (draggedIndex === null) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: "before" | "after" =
      event.clientY < midpoint ? "before" : "after";
    setDragOverIndex(index);
    setDropPosition(position);
  };

  const handleDrop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    if (
      draggedIndex === null ||
      dropPosition === null ||
      !selectedView ||
      draggedIndex === index
    ) {
      handleDragEnd();
      return;
    }

    let insertionIndex = index;
    if (dropPosition === "after") {
      insertionIndex = index + 1;
    }
    if (draggedIndex < insertionIndex) {
      insertionIndex -= 1;
    }
    if (draggedIndex === insertionIndex) {
      handleDragEnd();
      return;
    }

    const nextBlocks = [...selectedView.blocks];
    const [movingBlock] = nextBlocks.splice(draggedIndex, 1);
    nextBlocks.splice(insertionIndex, 0, movingBlock);
    updateSelectedView({ blocks: nextBlocks });
    handleDragEnd();
  };

  const renderBlock = (block: OutputBlock, index: number) => {
    const showInsertionBar =
      dragOverIndex === index && dropPosition && draggedIndex !== null;
    const isDisplayBlock = (block as DisplayBlock).kind !== undefined;
    const key =
      "kind" in block
        ? block.id ?? `${block.kind}-${index}`
        : (block as OutputFieldBlock).id;
    const dragProps = {
      onDragStart: handleDragStart(index),
      onDragEnd: handleDragEnd,
      isDragging: draggedIndex === index,
    };
    const handleDisplayUpdate = (updates: Partial<DisplayBlock>) =>
      updateBlockAtIndex(index, updates);

    return (
      <div key={key} className="relative">
        {showInsertionBar && dropPosition === "before" && (
          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
        <div
          className="transition-all"
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
        >
          {isDisplayBlock ? (
            (() => {
              const displayBlock = block as DisplayBlock;
              switch (displayBlock.kind) {
                case "header":
                  return (
                    <EditableHeaderBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "text":
                  return (
                    <EditableTextBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "label":
                  return (
                    <EditableLabelBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "divider":
                  return (
                    <EditableDividerBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "spacer":
                  return (
                    <EditableSpacerBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "html":
                  return (
                    <EditableHtmlBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "image":
                  return (
                    <EditableImageBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                case "quote":
                  return (
                    <EditableQuoteBlock
                      block={displayBlock}
                      onUpdate={handleDisplayUpdate}
                      onRemove={() => removeBlockAtIndex(index)}
                      previousFields={outputFields}
                      {...dragProps}
                    />
                  );
                default:
                  return null;
              }
            })()
          ) : (
            <EditableOutputFieldBlock
              block={block as OutputFieldBlock}
              availableFields={outputFields}
              onUpdate={(updates) => updateBlockAtIndex(index, updates)}
              onRemove={() => removeBlockAtIndex(index)}
              {...dragProps}
            />
          )}
        </div>
        {showInsertionBar && dropPosition === "after" && (
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mx-auto w-full max-w-4xl">
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Output views
            </h2>
            <Button onClick={addView} color={ButtonColor.Blue}>
              Add output view
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <p className="text-sm text-gray-600">Current output fields:</p>
            {outputFields.length > 0 ? (
              outputFields.map((field) => (
                <span
                  key={field.id}
                  className="px-3 py-2 bg-zinc-100 text-black text-sm rounded-sm border border-zinc-200"
                >
                  {field.label}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500">
                No output fields selected yet.
              </span>
            )}
          </div>
        </div>

        {schema.outputViews && schema.outputViews.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(schema.outputViews ?? []).map((view) => {
                const isActive =
                  (selectedView?.id ?? selectedViewId) === view.id;
                return (
                  <div key={view.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedViewId(view.id)}
                      className={`px-3 py-1.5 rounded-l-md border text-sm ${isActive
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                        }`}
                    >
                      {view.title || "Untitled view"}
                    </button>
                    <button
                      type="button"
                      disabled={(schema.outputViews ?? []).length <= 1}
                      onClick={() => removeView(view.id)}
                      className={`px-2 py-1.5 rounded-r-md border border-l-0 text-sm ${(schema.outputViews ?? []).length <= 1
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "bg-gray-100 text-gray-500 hover:text-red-500 hover:bg-red-50 border-gray-200"
                        }`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedView ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      View title
                    </label>
                    <input
                      type="text"
                      value={selectedView.title || ""}
                      onChange={(event) =>
                        updateSelectedView({ title: event.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Output view title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Layout
                    </label>
                    <select
                      value={selectedView.type || "default"}
                      onChange={(event) =>
                        updateSelectedView({
                          type: event.target.value as OutputViewSchema["type"],
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="default">Default</option>
                      <option value="page">Detail page</option>
                      <option value="card">Activity list card</option>
                      <option value="personal">Personal response view</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue=""
                      className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                      onChange={(event) => {
                        const nextKind = event.target.value as DisplayKind;
                        addDisplayBlock(nextKind);
                        event.currentTarget.selectedIndex = 0;
                      }}
                    >
                      <option value="" disabled hidden>
                        Add display block…
                      </option>
                      {DISPLAY_BLOCK_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind.charAt(0).toUpperCase() + kind.slice(1)} block
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addOutputBlock}
                    disabled={!outputFields.length}
                    className={`px-3 py-2 rounded-md text-sm border ${outputFields.length
                        ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    Add output field block
                  </button>
                  {!outputFields.length && (
                    <p className="text-xs text-gray-500">
                      Mark fields as outputs in the form builder to enable this.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedView.blocks.length === 0 && (
                    <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-6 text-center">
                      No blocks added yet. Use the controls above to add display
                      or output blocks.
                    </div>
                  )}
                  {selectedView.blocks.map((block, index) =>
                    renderBlock(block, index)
                  )}
                  {draggedIndex !== null &&
                    selectedView &&
                    selectedView.blocks.length > 0 && (
                      <div
                        className="relative h-4 -mt-2"
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverIndex(selectedView.blocks.length - 1);
                          setDropPosition("after");
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!selectedView) return;
                          if (draggedIndex === null) {
                            handleDragEnd();
                            return;
                          }
                          const nextBlocks = [...selectedView.blocks];
                          const [movingBlock] = nextBlocks.splice(
                            draggedIndex,
                            1
                          );
                          nextBlocks.push(movingBlock);
                          updateSelectedView({ blocks: nextBlocks });
                          handleDragEnd();
                        }}
                      ></div>
                    )}
                </div>
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Output preview
                    </h3>
                  </div>
                  {selectedView.blocks.length > 0 ? (
                    <div className="border-t border-gray-200 pt-2">
                      <OutputRenderer
                        submission={{
                          id: 0,
                          formId: 0,
                          answers: previewAnswers,
                          visibilityValidatorResults: {},
                          publicAnswers: Object.fromEntries(
                            outputFields.map((field) => [field.id, true])
                          ),
                          schemaSnapshot: schema as unknown as Record<
                            string,
                            unknown
                          >,
                        }}
                        viewId={selectedView.id}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Add at least one block to see a preview.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-8">
            No output views yet. Click &ldquo;Add output view&rdquo; to get
            started.
          </div>
        )}
      </div>
    </div>
  );
}
