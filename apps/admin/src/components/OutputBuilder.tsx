import {
  DISPLAY_KIND_NAMES,
  elementInternalDescriptor,
} from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  FormSchema,
  OutputBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { BlockWriteById } from "../lib/displayBlockById";
import { createDisplayBlock } from "./display-blocks";
import { OutputBlockList } from "./output-builder/OutputBlockList";
import {
  DISPLAY_BLOCK_KINDS,
  type OutputDisplayBlockKind,
} from "./output-builder/outputDisplayKinds";
import { OutputPreview } from "./output-builder/OutputPreview";

const collectOutputFields = (schema: FormSchema): AnyField[] => {
  const result: AnyField[] = [];
  schema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (field.type === "input") {
        if (field.output?.output) {
          result.push(field);
        }
      }
    });
  });
  return result;
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
  /** Owned by the builder above, which outlives a view switch. */
  onUpdateBlockById: BlockWriteById;
  /** Remounts the block editors when it changes, as after undo. */
  editorsKey: number;
  /** Null, or a view that's gone, shows the first view. */
  selectedViewId: string | null;
  onSelectView: (viewId: string | null) => void;
}

export function OutputBuilder({
  schema,
  onSchemaChange,
  onUpdateBlockById,
  editorsKey,
  selectedViewId,
  onSelectView: setSelectedViewId,
}: OutputBuilderProps) {
  const outputFields = useMemo(() => collectOutputFields(schema), [schema]);

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
  }, [schema.outputViews, selectedViewId, setSelectedViewId]);

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
      view.id === selectedView.id ? { ...view, ...updates } : view,
    );
    updateViews(nextViews);
  };

  const appendBlock = (block: OutputBlock) => {
    if (!selectedView) return;
    updateSelectedView({ blocks: [...selectedView.blocks, block] });
  };

  const addDisplayBlock = (kind: OutputDisplayBlockKind) =>
    appendBlock(
      createDisplayBlock(
        kind,
        `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ),
    );

  const addOutputBlock = () => {
    if (!outputFields.length) {
      return;
    }
    appendBlock({
      id: `output-field-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      fieldId: outputFields[0].id,
      showLabel: true,
      format: "field",
    });
  };

  const addView = () => {
    const newView = buildNewView(schema);
    const nextViews = [...(schema.outputViews ?? []), newView];
    updateViews(nextViews);
    setSelectedViewId(newView.id);
  };

  const removeView = (viewId: string) => {
    const nextViews = (schema.outputViews ?? []).filter(
      (view) => view.id !== viewId,
    );
    updateViews(nextViews);
    if (selectedViewId === viewId) {
      setSelectedViewId(nextViews[0]?.id ?? null);
    }
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
                  {elementInternalDescriptor(field)}
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
                      className={cn(
                        "px-3 py-1.5 rounded-l-md border text-sm",
                        isActive
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
                      )}
                    >
                      {view.title || "Untitled view"}
                    </button>
                    <button
                      type="button"
                      disabled={(schema.outputViews ?? []).length <= 1}
                      onClick={() => removeView(view.id)}
                      className={cn(
                        "px-2 py-1.5 rounded-r-md border border-l-0 text-sm",
                        (schema.outputViews ?? []).length <= 1
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "bg-gray-100 text-gray-500 hover:text-red-500 hover:bg-red-50 border-gray-200",
                      )}
                    >
                      <X size={20} />
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
                        const nextKind = event.target
                          .value as OutputDisplayBlockKind;
                        addDisplayBlock(nextKind);
                        event.currentTarget.selectedIndex = 0;
                      }}
                    >
                      <option value="" disabled hidden>
                        Add display block…
                      </option>
                      {DISPLAY_BLOCK_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {DISPLAY_KIND_NAMES[kind]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addOutputBlock}
                    disabled={!outputFields.length}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm border",
                      outputFields.length
                        ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed",
                    )}
                  >
                    Add output field block
                  </button>
                  {!outputFields.length && (
                    <p className="text-xs text-gray-500">
                      Mark fields as outputs in the form builder to enable this.
                    </p>
                  )}
                </div>

                <OutputBlockList
                  key={editorsKey}
                  view={selectedView}
                  outputFields={outputFields}
                  onBlocksChange={(blocks) => updateSelectedView({ blocks })}
                  onUpdateBlockById={onUpdateBlockById}
                />
                <OutputPreview
                  schema={schema}
                  view={selectedView}
                  outputFields={outputFields}
                />
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
