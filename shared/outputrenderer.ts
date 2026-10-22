import { ExceptionEvent } from "@alliance/common/analytics";
import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { outputBlockLabelOverride } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  FormValue,
  ListField,
  OutputFieldBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import {
  collectOutputFieldMap,
  drawnCards,
  resolveOutputBlocks,
  type ResolveOutputParams,
} from "@alliance/common/forms/output-resolution";
import { isOutputValueMissing } from "@alliance/common/forms/output-values";
import { getRankingOptionLabel } from "@alliance/common/forms/ranking";
import {
  interpolateDisplayBlock,
  interpolateFieldText,
  interpolateOutputFieldBlock,
} from "@alliance/common/forms/variable-interpolation";
import { withCount } from "@alliance/common/plural";
import { captureException } from "./lib/analytics";

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

export const formatOutputFieldValue = (
  field: AnyField,
  value: FormValue | undefined,
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
    case "ranking": {
      const values = Array.isArray(value) ? value : [];
      return values
        .map(
          (entry, index) =>
            `${index + 1}. ${getRankingOptionLabel(field, String(entry))}`,
        )
        .join(", ");
    }
    case "city": {
      const city = parseCityValue(value);
      return city ? formatCityValue(city) : String(value);
    }
    case "list":
      return withCount(drawnCards(field, value).length, "item");
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
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
};

const buildOutputField = (
  field: AnyField,
  block: OutputFieldBlock,
): AnyField => {
  const withLabel: AnyField = {
    ...field,
    label: block.showLabel
      ? (outputBlockLabelOverride(block) ?? field.label)
      : null,
    required: false,
  };

  if (field.kind === "list") {
    const listField = field as ListField;
    (withLabel as ListField).fields = (listField.fields ?? []).map(
      (subField) => ({
        ...subField,
        required: false,
      }),
    );
  }

  return withLabel;
};

export const resolveOutputItems = (
  params: ResolveOutputParams,
): {
  selectedView: OutputViewSchema | null;
  items: ResolvedOutputItem[];
  fieldLookup: Map<string, AnyField>;
} => {
  const resolved = resolveOutputBlocks(params);
  if (!resolved) {
    return {
      selectedView: null,
      items: [],
      fieldLookup: collectOutputFieldMap(params.schema),
    };
  }
  const {
    selectedView,
    fieldLookup,
    answers,
    visibleBlocks,
    variableValues,
    malformedListFieldIds,
  } = resolved;

  for (const fieldId of malformedListFieldIds) {
    const message = `Stored answer for list field ${fieldId} is not a list of rows`;
    console.error(message);
    captureException(ExceptionEvent.MalformedListAnswer, new Error(message), {
      fieldId,
    });
  }

  // Substituted here rather than in each renderer so every consumer of an item
  // — label, override and field text alike — sees the same resolved values.
  const items = visibleBlocks.map((rawBlock, index): ResolvedOutputItem => {
    const key =
      "kind" in rawBlock
        ? (rawBlock.id ?? `${rawBlock.kind}-${index}`)
        : rawBlock.id;

    if ("kind" in rawBlock) {
      return {
        type: "display",
        key,
        block: interpolateDisplayBlock(
          rawBlock as DisplayBlock,
          variableValues,
        ),
      };
    }

    const block = interpolateOutputFieldBlock(rawBlock, variableValues);
    const schemaField = fieldLookup.get(block.fieldId);
    const field = schemaField
      ? interpolateFieldText(schemaField, variableValues)
      : undefined;

    return {
      type: "field",
      key,
      block,
      field,
      renderField: field ? buildOutputField(field, block) : undefined,
      label: outputBlockLabelOverride(block) ?? field?.label ?? "Missing field",
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
