import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import type {
  CustomComponentConfigField,
  CustomComponentDefinition,
} from "@alliance/sharedweb/forms/components";
import {
  customComponentRegistry,
  getCustomComponentById,
} from "@alliance/sharedweb/forms/components";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  externalShareTargetsLoadError,
  externalShareTargetsQuery,
} from "../../lib/externalShareTargetsQuery";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const toDisplayLabel = (name: string, label?: string) => {
  if (label) return label;
  const withSpaces = name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const normalizeComponentConfig = (config: Record<string, unknown>) => {
  const cleaned = { ...config };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

const buildDefaultConfig = (component?: CustomComponentDefinition) => {
  if (!component?.configFields?.length) {
    return undefined;
  }
  const defaults: Record<string, unknown> = {};
  for (const field of component.configFields) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
    }
  }
  return Object.keys(defaults).length ? defaults : undefined;
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
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
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
      componentConfig: buildDefaultConfig(fallbackComponent),
      defaultValue: undefined,
    } as Partial<CustomComponentField>);
    setConfigDrafts({});
    setConfigErrors({});
  }, [field.componentId, onUpdate, fallbackComponent]);

  const selectedComponent = useMemo(
    () => getCustomComponentById(field.componentId),
    [field.componentId],
  );

  const componentConfig = useMemo(
    () => (field.componentConfig ?? {}) as Record<string, unknown>,
    [field.componentConfig],
  );

  useEffect(() => {
    if (!selectedComponent?.configFields?.length) {
      setConfigDrafts({});
      setConfigErrors({});
      return;
    }
    const drafts: Record<string, string> = {};
    for (const configField of selectedComponent.configFields) {
      const rawValue = componentConfig[configField.name];
      if (typeof rawValue === "string") {
        drafts[configField.name] = rawValue;
      } else if (
        typeof rawValue === "number" ||
        typeof rawValue === "boolean"
      ) {
        drafts[configField.name] = String(rawValue);
      } else if (configField.defaultValue !== undefined) {
        drafts[configField.name] = String(configField.defaultValue);
      } else {
        drafts[configField.name] = "";
      }
    }
    setConfigDrafts(drafts);
    setConfigErrors({});
  }, [selectedComponent, componentConfig]);

  useEffect(() => {
    if (!selectedComponent?.configFields?.length) {
      return;
    }
    const nextConfig = { ...componentConfig };
    let changed = false;
    for (const configField of selectedComponent.configFields) {
      if (
        configField.defaultValue !== undefined &&
        !(configField.name in nextConfig)
      ) {
        nextConfig[configField.name] = configField.defaultValue;
        changed = true;
      }
    }
    if (changed) {
      onUpdate({
        componentConfig: normalizeComponentConfig(nextConfig),
      } as Partial<CustomComponentField>);
    }
  }, [selectedComponent, componentConfig, onUpdate]);

  const handleComponentChange = (componentId: string) => {
    const nextComponent = getCustomComponentById(componentId);
    const updates: Partial<CustomComponentField> = {
      componentId,
      componentConfig: buildDefaultConfig(nextComponent),
      defaultValue: undefined,
    };
    onUpdate(updates);
    setConfigDrafts({});
    setConfigErrors({});
  };

  const handleStringChange = (name: string, value: string) => {
    setConfigDrafts((prev) => ({ ...prev, [name]: value }));
    setConfigErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    const nextConfig = { ...componentConfig };
    if (!value.trim()) {
      delete nextConfig[name];
    } else {
      nextConfig[name] = value;
    }
    onUpdate({
      componentConfig: normalizeComponentConfig(nextConfig),
    } as Partial<CustomComponentField>);
  };

  const handleNumberChange = (name: string, rawValue: string) => {
    setConfigDrafts((prev) => ({ ...prev, [name]: rawValue }));
    if (!rawValue.trim()) {
      setConfigErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      const nextConfig = { ...componentConfig };
      delete nextConfig[name];
      onUpdate({
        componentConfig: normalizeComponentConfig(nextConfig),
      } as Partial<CustomComponentField>);
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setConfigErrors((prev) => ({
        ...prev,
        [name]: "Enter a valid number",
      }));
      return;
    }

    setConfigErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    const nextConfig = { ...componentConfig, [name]: parsed };
    onUpdate({
      componentConfig: normalizeComponentConfig(nextConfig),
    } as Partial<CustomComponentField>);
  };

  const handleBooleanChange = (name: string, checked: boolean) => {
    setConfigDrafts((prev) => ({
      ...prev,
      [name]: checked ? "true" : "false",
    }));
    setConfigErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    const nextConfig = { ...componentConfig, [name]: checked };
    onUpdate({
      componentConfig: normalizeComponentConfig(nextConfig),
    } as Partial<CustomComponentField>);
  };

  const renderConfigField = (configField: CustomComponentConfigField) => {
    const error = configErrors[configField.name];
    const label = toDisplayLabel(configField.name, configField.label);
    const description = configField.description;
    const draftValue = configDrafts[configField.name] ?? "";

    if (
      field.componentId === "share-url" &&
      configField.name === "externalTargetId"
    ) {
      return (
        <ExternalShareTargetSelect
          key={configField.name}
          label={label}
          description={description}
          value={
            typeof componentConfig[configField.name] === "number"
              ? (componentConfig[configField.name] as number)
              : null
          }
          onChange={(id) => handleNumberChange(configField.name, String(id))}
          onClear={() => handleNumberChange(configField.name, "")}
          error={error}
        />
      );
    }

    if (configField.type === "boolean") {
      const checked =
        typeof componentConfig[configField.name] === "boolean"
          ? (componentConfig[configField.name] as boolean)
          : draftValue === "true";
      const inputId = `custom-config-${configField.name}`;
      return (
        <div key={configField.name} className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              id={inputId}
              checked={checked}
              onChange={(event) =>
                handleBooleanChange(configField.name, event.target.checked)
              }
              className="h-4 w-4"
            />
            <label htmlFor={inputId}>{label}</label>
          </div>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    }

    if (configField.type === "number") {
      return (
        <div key={configField.name} className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}
          </label>
          <input
            type="number"
            value={draftValue}
            onChange={(event) =>
              handleNumberChange(configField.name, event.target.value)
            }
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    }

    return (
      <div key={configField.name} className="space-y-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          type="text"
          value={draftValue}
          onChange={(event) =>
            handleStringChange(configField.name, event.target.value)
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={`Enter ${label.toLowerCase()}`}
        />
        {description && <p className="text-xs text-gray-500">{description}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
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

          {selectedComponent?.configFields?.length ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Component Configuration
              </label>
              <div className="space-y-3">
                {selectedComponent.configFields.map(renderConfigField)}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </FieldWrapper>
  );
}

interface ExternalShareTargetSelectProps {
  label: string;
  description?: string;
  value: number | null;
  onChange: (id: number) => void;
  onClear: () => void;
  error?: string;
}

function ExternalShareTargetSelect({
  label,
  description,
  value,
  onChange,
  onClear,
  error,
}: ExternalShareTargetSelectProps) {
  const {
    data: targets,
    isPending,
    error: loadError,
  } = useQuery(externalShareTargetsQuery);

  const hasTargets = !!targets && targets.length > 0;
  const isOrphaned =
    !isPending &&
    value !== null &&
    !!targets &&
    !targets.some((t) => t.id === value);
  const showSelect = hasTargets || isOrphaned;

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      {isPending ? (
        <p className="text-xs text-gray-500">Loading targets…</p>
      ) : !targets ? (
        <p className="text-xs text-red-600">
          {externalShareTargetsLoadError(loadError)}
        </p>
      ) : showSelect ? (
        <select
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              onClear();
            } else {
              onChange(Number(next));
            }
          }}
          className="bg-white w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a target…</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
          {isOrphaned && (
            <option value={value!}>Missing target #{value}</option>
          )}
        </select>
      ) : (
        <p className="text-xs text-gray-500">
          No external share targets configured yet.
        </p>
      )}
      <p className="text-xs text-gray-500">
        {description}
        {description ? " " : ""}
        <Link to="/share-targets" className="text-blue-600 hover:underline">
          Manage targets →
        </Link>
      </p>
      {isOrphaned && (
        <p className="text-xs text-amber-600">
          Selected target #{value} no longer exists. Pick another.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
