import { ExceptionEvent } from "@alliance/common/analytics";
import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { outputBlockLabelOverride } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  FormSchema,
  FormValue,
  ListField,
  ListFieldValue,
  OutputBlock,
  OutputFieldBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import {
  asCards,
  collectFieldLookup,
  collectGroupByFieldId,
  collectPageByFieldId,
  collectVariableResolutionFields,
  flattenPageItems,
  isQuestionField,
  variableInputFieldsById,
} from "@alliance/common/forms/form-schema";
import { getRankingOptionLabel } from "@alliance/common/forms/ranking";
import {
  interpolateDisplayBlock,
  interpolateFieldText,
  interpolateOutputFieldBlock,
} from "@alliance/common/forms/variable-interpolation";
import { evaluateVariable } from "@alliance/common/forms/variables";
import {
  isElementCurrentlyVisible,
  isVisibleInSavedResponse,
  replaysFromSavedResponse,
  stripHiddenListCells,
  type VisibilityValidatorResults,
} from "@alliance/common/forms/visibility";
import { withCount } from "@alliance/common/plural";
import {
  isOutputValueMissing,
  outputCardSubFields,
} from "./forms/outputValues";
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

type ResolveOutputItemsParams = {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  viewId?: string;
  validatorResults?: VisibilityValidatorResults;
  deviceType?: DeviceVisibilityTarget;
  publicAnswers?: Record<string, boolean>;
};

const visibilityContext = (
  validatorResults: VisibilityValidatorResults | undefined,
  deviceType: DeviceVisibilityTarget | undefined,
) => ({
  deviceType: deviceType ?? "desktop",
  visibilityValidatorResults: validatorResults ?? {},
});

const drawnCards = (
  listField: ListField,
  value: FormValue | undefined,
): ListFieldValue =>
  (asCards(value) ?? []).filter(
    (card) => outputCardSubFields(listField, card).length > 0,
  );

export const collectOutputFieldMap = (
  schema: FormSchema,
): Map<string, AnyField> => {
  const map = new Map<string, AnyField>();
  schema.pages.forEach((page) => {
    flattenPageItems(page.fields).forEach((field) => {
      if (isQuestionField(field)) {
        map.set(field.id, field);
      }
    });
  });
  return map;
};

export const resolveOutputView = (
  schema: FormSchema,
  viewId?: string,
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

export const isOutputBlockVisible = (
  block: OutputBlock,
  answers: Record<string, FormValue>,
  validatorResults?: VisibilityValidatorResults,
  deviceType?: DeviceVisibilityTarget,
  inputField?: AnyField,
  outputBlockVisibility?: Map<string, boolean>,
): boolean => {
  if (
    "fieldId" in block &&
    inputField?.kind === "list" &&
    drawnCards(inputField, answers[block.fieldId]).length === 0
  ) {
    return false;
  }
  return isElementCurrentlyVisible(block, answers, {
    ...visibilityContext(validatorResults, deviceType),
    outputBlockVisibility,
  });
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

export const resolveOutputItems = ({
  schema,
  answers: storedAnswers,
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

  const context = visibilityContext(validatorResults, deviceType);
  const conditionLookups = {
    fieldLookup: collectFieldLookup(schema.pages),
    groupByFieldId: collectGroupByFieldId(schema.pages),
    pageByFieldId: collectPageByFieldId(schema.pages),
  };
  const savedResponse = {
    deviceType,
    visibilityValidatorResults: context.visibilityValidatorResults,
    ...conditionLookups,
  };
  // A response stored before the server started stripping them can still hold a
  // cell under a sub-field its row hides. `isAnswerShown` already
  // re-checks a whole field this way.
  const answers = stripHiddenListCells({
    pages: schema.pages,
    answers: storedAnswers,
    extras: { ...context, ...conditionLookups },
    canJudge: (subField) =>
      replaysFromSavedResponse({ element: subField, ...savedResponse }),
  });

  const isAnswerShown = (fieldId: string): boolean => {
    const field = fieldLookup.get(fieldId);
    return (
      publicAnswers?.[fieldId] === true &&
      !isOutputValueMissing(answers[fieldId]) &&
      (!field ||
        isVisibleInSavedResponse({
          element: field,
          data: answers,
          ...savedResponse,
        }))
    );
  };

  const allBlocks = selectedView.blocks ?? [];
  const referencedFieldIds = new Set(
    allBlocks.flatMap((block) => ("fieldId" in block ? [block.fieldId] : [])),
  );
  for (const fieldId of referencedFieldIds) {
    if (
      fieldLookup.get(fieldId)?.kind === "list" &&
      asCards(answers[fieldId]) === null &&
      isAnswerShown(fieldId)
    ) {
      const message = `Stored answer for list field ${fieldId} is not a list of rows`;
      console.error(message);
      captureException(ExceptionEvent.MalformedListAnswer, new Error(message), {
        fieldId,
      });
    }
  }

  // Resolve visibility for every block, walking outputBlockVisible dependencies
  // first so a condition always sees a populated map. Any block (field or
  // display) can reference any other block by id. Cycles should be rejected by
  // validateFormSchema; the inProgress guard returns false if one slips past.
  const blockById = new Map<string, OutputBlock>();
  for (const b of allBlocks) {
    if (b.id) blockById.set(b.id, b);
  }
  const outputBlockVisibility = new Map<string, boolean>();
  const inProgress = new Set<string>();

  const evaluateBlockVisibility = (block: OutputBlock): boolean => {
    if ("kind" in block) {
      return isOutputBlockVisible(
        block,
        answers,
        validatorResults,
        deviceType,
        undefined,
        outputBlockVisibility,
      );
    }
    return (
      isAnswerShown(block.fieldId) &&
      isOutputBlockVisible(
        block,
        answers,
        validatorResults,
        deviceType,
        fieldLookup.get(block.fieldId),
        outputBlockVisibility,
      )
    );
  };

  const computeVisibility = (block: OutputBlock): boolean => {
    if (block.id) {
      const cached = outputBlockVisibility.get(block.id);
      if (cached !== undefined) return cached;
      if (inProgress.has(block.id)) return false;
      inProgress.add(block.id);
    }
    for (const cond of Object.values(
      block.visibleIfFormula?.conditions ?? {},
    )) {
      if (cond.kind === "outputBlockVisible") {
        const dep = blockById.get(cond.outputBlockVisible);
        if (dep && dep.id && !outputBlockVisibility.has(dep.id)) {
          computeVisibility(dep);
        }
      }
    }
    if (block.id) inProgress.delete(block.id);
    const visible = evaluateBlockVisibility(block);
    if (block.id) outputBlockVisibility.set(block.id, visible);
    return visible;
  };

  for (const block of allBlocks) computeVisibility(block);

  // Substituted here rather than in each renderer so every consumer of an item
  // — label, override and field text alike — sees the same resolved values.
  const variableContext = {
    answers,
    fields: variableInputFieldsById(collectVariableResolutionFields(schema)),
  };
  // A variable that fails stays out, so its `#{name}` shows as written.
  const variableValues = new Map<string, string>();
  for (const variable of schema.variables ?? []) {
    const value = evaluateVariable(variable, variableContext);
    if (value.ok) variableValues.set(variable.name, value.value);
  }

  const items = allBlocks
    .filter((block) =>
      block.id
        ? (outputBlockVisibility.get(block.id) ?? false)
        : evaluateBlockVisibility(block),
    )
    .map((rawBlock, index): ResolvedOutputItem => {
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
        label:
          outputBlockLabelOverride(block) ?? field?.label ?? "Missing field",
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
