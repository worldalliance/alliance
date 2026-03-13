import { isElementCurrentlyVisible } from "./formrenderer";
import type { DisplayBlock } from "./forms/display-blocks";
import type {
  AnyField,
  CityFieldValue,
  DeviceVisibilityTarget,
  FormSchema,
  FormValue,
  ListField,
  OutputBlock,
  OutputFieldBlock,
  OutputViewSchema,
} from "./forms/formschema";

export type ResolvedOutputDisplayItem = {
  type: "display";
  key: string;
  block: DisplayBlock;
};

export type ResolvedOutputFieldItem = {
  type: "field";
  key: string;
  block: OutputFieldBlock;
  field?: AnyField;
  renderField?: AnyField;
  label: string;
  showLabel: boolean;
  format: NonNullable<OutputFieldBlock["format"]>;
  value: FormValue | undefined;
  formattedValue: string;
  fileValues: string[];
};

export type ResolvedOutputItem =
  | ResolvedOutputDisplayItem
  | ResolvedOutputFieldItem;

type ResolveOutputItemsParams = {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  viewId?: string;
  validatorResults?: Record<number, boolean>;
  deviceType?: DeviceVisibilityTarget;
  publicAnswers?: Record<string, boolean>;
};

const isCityValue = (value: unknown): value is CityFieldValue => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.countryName === "string" &&
    "id" in candidate
  );
};

const formatCity = (value: CityFieldValue | string): string => {
  if (typeof value === "string") {
    return value;
  }
  const region = value.admin1?.trim();
  const country = value.countryName?.trim();
  const locationParts = [region, country].filter(
    (part): part is string => !!part && part.length > 0
  );
  const suffix = locationParts.length ? `, ${locationParts.join(", ")}` : "";
  return `${value.name}${suffix}`;
};

export const isOutputValueMissing = (value: FormValue | undefined): boolean => {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

export const collectOutputFieldMap = (schema: FormSchema): Map<string, AnyField> => {
  const map = new Map<string, AnyField>();
  schema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if ("kind" in field && "label" in field) {
        map.set(field.id, field);
      }
    });
  });
  return map;
};

export const resolveOutputView = (
  schema: FormSchema,
  viewId?: string
): OutputViewSchema | null => {
  const views = schema.outputViews ?? [];
  if (!views.length) {
    return null;
  }
  if (viewId) {
    const selected = views.find((candidate) => candidate.id === viewId);
    if (selected) {
      return selected;
    }
  }
  return views.find((candidate) => candidate.type === "default") ?? views[0];
};

export const formatOutputFieldValue = (
  field: AnyField,
  value: FormValue | undefined
): string => {
  if (isOutputValueMissing(value)) {
    return "";
  }
  switch (field.kind) {
    case "checkbox":
      return value ? "Yes" : "No";
    case "radio":
    case "select": {
      const stringValue = String(value);
      return (
        field.options?.find((option) => option.value === stringValue)?.label ??
        stringValue
      );
    }
    case "multiselect": {
      const values = Array.isArray(value) ? value : [];
      return values
        .map((entry) => {
          const stringValue = String(entry);
          return (
            field.options?.find((option) => option.value === stringValue)
              ?.label ?? stringValue
          );
        })
        .join(", ");
    }
    case "range":
      return String(value);
    case "city":
      if (isCityValue(value)) {
        return formatCity(value);
      }
      return formatCity(String(value));
    case "list": {
      const listValue = Array.isArray(value) ? value : [];
      return `${listValue.length} item${listValue.length === 1 ? "" : "s"}`;
    }
    case "file":
      return "";
    default:
      return Array.isArray(value)
        ? value.join(", ")
        : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : String(value);
  }
};

export const getOutputFileValues = (value: FormValue | undefined): string[] => {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );
};

export const isOutputBlockVisible = (
  block: OutputBlock,
  answers: Record<string, FormValue>,
  validatorResults?: Record<number, boolean>,
  deviceType?: DeviceVisibilityTarget,
  inputField?: AnyField
): boolean => {
  if (inputField) {
    const isVisible = isElementCurrentlyVisible(inputField, answers, {
      deviceType: deviceType ?? "desktop",
      visibilityValidatorResults: validatorResults ?? {},
    });
    if (!isVisible) {
      return false;
    }
  }
  if ("fieldId" in block && isOutputValueMissing(answers[block.fieldId])) {
    return false;
  }
  return isElementCurrentlyVisible(block, answers, {
    deviceType: deviceType ?? "desktop",
    visibilityValidatorResults: validatorResults ?? {},
  });
};

const buildOutputField = (
  field: AnyField,
  block: OutputFieldBlock
): AnyField => {
  const withLabel: AnyField = {
    ...field,
    label: block.showLabel ? block.labelOverride ?? field.label : null,
    required: false,
  };

  if (field.kind === "list") {
    const listField = field as ListField;
    (withLabel as ListField).fields = (listField.fields ?? []).map((subField) => ({
      ...subField,
      required: false,
    }));
  }

  return withLabel;
};

export const resolveOutputItems = ({
  schema,
  answers,
  viewId,
  validatorResults,
  deviceType,
  publicAnswers,
}: ResolveOutputItemsParams): {
  selectedView: OutputViewSchema | null;
  items: ResolvedOutputItem[];
  fieldLookup: Map<string, AnyField>;
} => {
  const fieldLookup = collectOutputFieldMap(schema);
  const selectedView = resolveOutputView(schema, viewId);

  if (!selectedView) {
    return { selectedView, items: [], fieldLookup };
  }

  const items = (selectedView.blocks ?? [])
    .filter(
      (block) =>
        isOutputBlockVisible(
          block,
          answers,
          validatorResults,
          deviceType,
          "fieldId" in block ? fieldLookup.get(block.fieldId) : undefined
        ) &&
        ("kind" in block || publicAnswers?.[block.fieldId] === true)
    )
    .map((block, index): ResolvedOutputItem => {
      const key =
        "kind" in block ? block.id ?? `${block.kind}-${index}` : block.id;

      if ("kind" in block) {
        return {
          type: "display",
          key,
          block: block as DisplayBlock,
        };
      }

      const field = fieldLookup.get(block.fieldId);

      return {
        type: "field",
        key,
        block,
        field,
        renderField: field ? buildOutputField(field, block) : undefined,
        label: block.labelOverride ?? field?.label ?? "Missing field",
        showLabel: block.showLabel ?? true,
        format: block.format ?? "field",
        value: answers[block.fieldId],
        formattedValue: field
          ? formatOutputFieldValue(field, answers[block.fieldId])
          : "",
        fileValues: getOutputFileValues(answers[block.fieldId]),
      };
    });

  return { selectedView, items, fieldLookup };
};
