import { useEffect, useMemo, useState } from "react";
import {
  customComponentRegistry,
  getCustomComponentById,
} from "@alliance/shared/forms/components";
import type { CustomComponentField } from "@alliance/shared/forms/formschema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const formatConfig = (value: CustomComponentField["componentConfig"]) => {
  if (!value || Object.keys(value).length === 0) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
};

export function EditableCustomComponentField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<CustomComponentField>) {
  const [configDraft, setConfigDraft] = useState(() =>
    formatConfig(field.componentConfig)
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const fallbackComponent = customComponentRegistry[0];

  useEffect(() => {
    if (field.componentId) {
      return;
    }
    if (!fallbackComponent) {
      return;
    }
    onUpdate({
      componentId: fallbackComponent.id,
      componentConfig: undefined,
      defaultValue: undefined,
    } as Partial<CustomComponentField>);
    setConfigDraft("");
    setConfigError(null);
  }, [field.componentId, onUpdate, fallbackComponent]);

  useEffect(() => {
    if (configError) {
      return;
    }
    setConfigDraft(formatConfig(field.componentConfig));
  }, [field.componentConfig, configError]);

  const selectedComponent = useMemo(
    () => getCustomComponentById(field.componentId),
    [field.componentId]
  );

  const handleComponentChange = (componentId: string) => {
    const updates: Partial<CustomComponentField> = {
      componentId,
      componentConfig: undefined,
      defaultValue: undefined,
    };
    onUpdate(updates);
    setConfigDraft("");
    setConfigError(null);
  };

  const handleConfigChange = (value: string) => {
    setConfigDraft(value);
    if (!value.trim()) {
      setConfigError(null);
      onUpdate({ componentConfig: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(value);
      setConfigError(null);
      onUpdate({ componentConfig: parsed });
    } catch {
      setConfigError("Component config must be valid JSON.");
    }
  };

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(value) => onUpdate({ label: value })}
      />

      {customComponentRegistry.length === 0 ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No custom components are registered. Please add one to the registry to
          use this field type.
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Custom Component
            </label>
            <select
              value={field.componentId || customComponentRegistry[0].id}
              onChange={(event) => handleComponentChange(event.target.value)}
              className="bg-white w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {customComponentRegistry.map((component) => (
                <option key={component.id} value={component.id}>
                  {component.label}
                </option>
              ))}
            </select>
            {selectedComponent?.description && (
              <p className="mt-1 text-xs text-gray-500">
                {selectedComponent.description}
              </p>
            )}
          </div>

          <RequiredToggle
            checked={field.required}
            onChange={(checked) => onUpdate({ required: checked })}
          />

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Component Config (JSON, optional)
            </label>
            <textarea
              value={configDraft}
              onChange={(event) => handleConfigChange(event.target.value)}
              rows={1}
              className="w-full rounded border border-gray-300 px-2 py-1 !text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional custom component configuration"
            />
            {configError !== null && (
              <p className="mt-1 text-xs text-red-600">{configError}</p>
            )}
          </div>
        </div>
      )}
    </FieldWrapper>
  );
}
