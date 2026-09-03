import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import {
  flattenPageItems,
  isQuestionField,
  type AggregateViewDisplayType,
  type AggregateViewSchema,
  type AggregateViewValue,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const inputBase =
  "w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
const inputText = cn(inputBase, "px-3 py-1.5");
const inputPad = cn(inputBase, "px-3 py-2");

const collectFields = (schema: FormSchema): AnyField[] => {
  const result: AnyField[] = [];
  schema.pages.forEach((page) => {
    flattenPageItems(page.fields).forEach((field) => {
      if (isQuestionField(field)) {
        result.push(field);
      }
    });
  });
  return result;
};

const collectNumberFields = (schema: FormSchema): AnyField[] =>
  collectFields(schema).filter((field) => field.kind === "number");

const buildNewView = (schema: FormSchema): AggregateViewSchema => {
  const firstField = collectNumberFields(schema)[0];
  return {
    id: `aggregate-view-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
    kind: "progressbar",
    title: "Progress Bar",
    caption: "Progress:",
    numerator:
      firstField != null
        ? { type: "numberfield", fieldId: firstField.id }
        : { type: "number", value: 0 },
    denominator: { type: "number", value: 100 },
    displayType: "number",
  };
};

interface AggregateBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

export function AggregateBuilder({
  schema,
  onSchemaChange,
}: AggregateBuilderProps) {
  const [selectedViewId, setSelectedViewId] = useState<string | null>(
    () => schema.aggregateViews?.[0]?.id ?? null,
  );
  const [numberDrafts, setNumberDrafts] = useState({
    numerator: "0",
    denominator: "100",
  });
  const availableFields = useMemo(() => collectNumberFields(schema), [schema]);

  useEffect(() => {
    if (!schema.aggregateViews || schema.aggregateViews.length === 0) {
      setSelectedViewId(null);
      return;
    }
    if (
      !selectedViewId ||
      !schema.aggregateViews.some((view) => view.id === selectedViewId)
    ) {
      setSelectedViewId(schema.aggregateViews[0].id);
    }
  }, [schema.aggregateViews, selectedViewId]);

  const selectedView: AggregateViewSchema | null = useMemo(() => {
    if (!schema.aggregateViews || schema.aggregateViews.length === 0) {
      return null;
    }
    return (
      schema.aggregateViews.find((view) => view.id === selectedViewId) ??
      schema.aggregateViews[0]
    );
  }, [schema.aggregateViews, selectedViewId]);

  useEffect(() => {
    if (!selectedView) {
      return;
    }
    setNumberDrafts({
      numerator:
        selectedView.numerator.type === "number"
          ? String(selectedView.numerator.value)
          : "0",
      denominator:
        selectedView.denominator.type === "number"
          ? String(selectedView.denominator.value)
          : "0",
    });
  }, [selectedView]);

  const updateViews = (views: AggregateViewSchema[]) => {
    onSchemaChange({
      ...schema,
      aggregateViews: views,
    });
  };

  const addView = () => {
    const nextView = buildNewView(schema);
    updateViews([...(schema.aggregateViews ?? []), nextView]);
    setSelectedViewId(nextView.id);
  };

  const removeView = (viewId: string) => {
    const nextViews = (schema.aggregateViews ?? []).filter(
      (view) => view.id !== viewId,
    );
    updateViews(nextViews);
    if (selectedViewId === viewId) {
      setSelectedViewId(nextViews[0]?.id ?? null);
    }
  };

  const updateSelectedView = (updates: Partial<AggregateViewSchema>) => {
    if (!selectedView) return;
    const nextViews = (schema.aggregateViews ?? []).map((view) =>
      view.id === selectedView.id ? { ...view, ...updates } : view,
    );
    updateViews(nextViews);
  };

  const normalizeFieldValue = (
    value: AggregateViewValue,
  ): AggregateViewValue => {
    if (value.type !== "numberfield") {
      return value;
    }
    if (availableFields.some((field) => field.id === value.fieldId)) {
      return value;
    }
    const firstField = availableFields[0];
    return firstField
      ? { type: "numberfield", fieldId: firstField.id }
      : { type: "number", value: 0 };
  };

  const updateValue = (
    key: "numerator" | "denominator",
    value: AggregateViewValue,
  ) => {
    updateSelectedView({ [key]: normalizeFieldValue(value) });
  };

  const commitNumberDraft = (key: "numerator" | "denominator") => {
    const raw = numberDrafts[key].trim();
    if (raw === "") {
      updateValue(key, { type: "number", value: 0 });
      setNumberDrafts((prev) => ({ ...prev, [key]: "0" }));
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      const fallback =
        selectedView && selectedView[key].type === "number"
          ? String(selectedView[key].value)
          : "0";
      setNumberDrafts((prev) => ({ ...prev, [key]: fallback }));
      return;
    }
    updateValue(key, { type: "number", value: parsed });
    setNumberDrafts((prev) => ({ ...prev, [key]: String(parsed) }));
  };

  const renderValueEditor = (
    label: string,
    value: AggregateViewValue,
    key: "numerator" | "denominator",
  ) => (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <select
        value={value.type}
        onChange={(event) => {
          const nextType = event.target.value as AggregateViewValue["type"];
          if (nextType === "number") {
            updateValue(key, { type: "number", value: 0 });
            return;
          }
          const firstField = availableFields[0];
          updateValue(
            key,
            firstField
              ? { type: "numberfield", fieldId: firstField.id }
              : { type: "number", value: 0 },
          );
        }}
        className={cn(inputPad, "bg-white")}
      >
        <option value="number">Static number</option>
        {availableFields.length > 0 && (
          <option value="numberfield">Number field</option>
        )}
      </select>
      {value.type === "number" ? (
        <input
          type="number"
          value={numberDrafts[key]}
          onChange={(event) =>
            setNumberDrafts((prev) => ({ ...prev, [key]: event.target.value }))
          }
          onBlur={() => commitNumberDraft(key)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className={inputPad}
        />
      ) : (
        <select
          value={value.fieldId}
          onChange={(event) =>
            updateValue(key, {
              type: "numberfield",
              fieldId: event.target.value,
            })
          }
          disabled={availableFields.length === 0}
          className={cn(
            inputPad,
            "bg-white disabled:bg-gray-100 disabled:text-gray-400",
          )}
        >
          {availableFields.length > 0 ? (
            availableFields.map((field) => (
              <option key={field.id} value={field.id}>
                {fieldPickerLabel(field)}
              </option>
            ))
          ) : (
            <option value="">No fields available</option>
          )}
        </select>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mx-auto w-full max-w-4xl">
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Aggregate views
            </h2>
            <Button onClick={addView} color={ButtonColor.Blue}>
              Add aggregate view
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Configure action-level summary visuals from form responses.
          </p>
        </div>

        {schema.aggregateViews && schema.aggregateViews.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(schema.aggregateViews ?? []).map((view, index) => {
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
                      View {index + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeView(view.id)}
                      className={cn(
                        "px-2 py-1.5 rounded-r-md border border-l-0 text-sm",
                        "bg-gray-100 text-gray-500 hover:text-red-500 hover:bg-red-50 border-gray-200",
                      )}
                    >
                      <X size={16} strokeWidth={2.25} />
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
                      Title
                    </label>
                    <input
                      type="text"
                      value={selectedView.title}
                      onChange={(event) =>
                        updateSelectedView({ title: event.target.value })
                      }
                      placeholder="Progress title"
                      className={inputText}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Caption
                    </label>
                    <input
                      type="text"
                      value={selectedView.caption}
                      onChange={(event) =>
                        updateSelectedView({ caption: event.target.value })
                      }
                      placeholder="Optional caption shown beside totals"
                      className={inputText}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Display type
                  </label>
                  <select
                    value={selectedView.displayType ?? "number"}
                    onChange={(event) =>
                      updateSelectedView({
                        displayType: event.target
                          .value as AggregateViewDisplayType,
                      })
                    }
                    className={cn(inputPad, "md:w-64 bg-white")}
                  >
                    <option value="number">Number</option>
                    <option value="dollars">Dollars</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderValueEditor(
                    "Numerator",
                    selectedView.numerator,
                    "numerator",
                  )}
                  {renderValueEditor(
                    "Denominator",
                    selectedView.denominator,
                    "denominator",
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-8">
            No aggregate views yet. Click &ldquo;Add aggregate view&rdquo; to
            get started.
          </div>
        )}
      </div>
    </div>
  );
}
