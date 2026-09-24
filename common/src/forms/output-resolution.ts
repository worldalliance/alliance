import type { DeviceVisibilityTarget } from "./device";
import {
  asCards,
  collectFieldLookup,
  collectGroupByFieldId,
  collectPageByFieldId,
  collectVariableResolutionFields,
  flattenPageItems,
  isQuestionField,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListField,
  type ListFieldValue,
  type OutputBlock,
  type OutputViewSchema,
} from "./form-schema";
import { isOutputValueMissing, outputCardSubFields } from "./output-values";
import {
  forEachInterpolatableText,
  interpolateDisplayBlock,
  interpolateFieldText,
  interpolateOutputFieldBlock,
} from "./variable-interpolation";
import { collectVariableReferences, evaluateVariable } from "./variables";
import {
  isElementCurrentlyVisible,
  isVisibleInSavedResponse,
  stripHiddenListCells,
  type VisibilityValidatorResults,
} from "./visibility";

export type ResolveOutputParams = {
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

export const isOutputAnswerShown = (
  isPublic: boolean | undefined,
  value: FormValue | undefined,
): boolean => isPublic === true && !isOutputValueMissing(value);

export const drawnCards = (
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

const blockFieldIds = (blocks: OutputBlock[]): string[] => [
  ...new Set(
    blocks.flatMap((block) => ("fieldId" in block ? [block.fieldId] : [])),
  ),
];

const isOutputBlockVisible = (
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

export const resolveOutputBlocks = ({
  schema,
  answers: storedAnswers,
  viewId,
  validatorResults,
  deviceType,
  publicAnswers,
}: ResolveOutputParams): {
  selectedView: OutputViewSchema;
  fieldLookup: Map<string, AnyField>;
  answers: Record<string, FormValue>;
  visibleBlocks: OutputBlock[];
  variableValues: Map<string, string>;
  /** Public list answers the view draws that aren't a list of rows. */
  malformedListFieldIds: string[];
} | null => {
  const fieldLookup = collectOutputFieldMap(schema);
  const selectedView = resolveOutputView(schema, viewId);

  if (!selectedView) {
    return null;
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
  // cell under a sub-field its row hides. `visibleAnswers` already drops a
  // whole field this way.
  const answers = stripHiddenListCells({
    pages: schema.pages,
    answers: storedAnswers,
    isVisible: (subField, rowData) =>
      isVisibleInSavedResponse({
        element: subField,
        data: rowData,
        ...savedResponse,
      }),
  });

  const visibleAnswers = Object.fromEntries(
    Object.entries(answers).filter(([fieldId]) => {
      const field = fieldLookup.get(fieldId);
      return (
        !field ||
        isVisibleInSavedResponse({
          element: field,
          data: answers,
          ...savedResponse,
        })
      );
    }),
  );

  const isAnswerShown = (fieldId: string): boolean =>
    isOutputAnswerShown(publicAnswers?.[fieldId], visibleAnswers[fieldId]);

  const allBlocks = selectedView.blocks ?? [];

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
        visibleAnswers,
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
        visibleAnswers,
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

  const visibleBlocks = allBlocks.filter((block) =>
    block.id
      ? (outputBlockVisibility.get(block.id) ?? false)
      : evaluateBlockVisibility(block),
  );

  const referenced = new Set<string>();
  forEachInterpolatableText(
    {
      pages: [
        {
          id: "output",
          fields: blockFieldIds(visibleBlocks).flatMap((fieldId) => {
            const field = fieldLookup.get(fieldId);
            return field ? [field] : [];
          }),
        },
      ],
      outputViews: [{ ...selectedView, blocks: visibleBlocks }],
    },
    (text) => {
      for (const name of collectVariableReferences(text)) referenced.add(name);
    },
  );
  const variableContext = {
    answers: visibleAnswers,
    fields: variableInputFieldsById(collectVariableResolutionFields(schema)),
  };
  // A variable that fails stays out, so its `#{name}` shows as written.
  const variableValues = new Map<string, string>();
  for (const variable of schema.variables ?? []) {
    if (!referenced.has(variable.name)) continue;
    const value = evaluateVariable(variable, variableContext);
    if (value.ok) variableValues.set(variable.name, value.value);
  }

  return {
    selectedView,
    fieldLookup,
    answers,
    visibleBlocks,
    variableValues,
    malformedListFieldIds: blockFieldIds(allBlocks).filter(
      (fieldId) =>
        fieldLookup.get(fieldId)?.kind === "list" &&
        asCards(answers[fieldId]) === null &&
        isAnswerShown(fieldId),
    ),
  };
};

const drawnField = (field: AnyField): AnyField => {
  const bare = { ...field, visibleIfFormula: undefined };
  if (bare.kind !== "list") return bare;
  const hiddenInOutputIds = new Set(bare.outputViewHiddenFieldIds ?? []);
  return {
    ...bare,
    outputViewHiddenFieldIds: undefined,
    fields: bare.fields
      .filter((sub) => !hiddenInOutputIds.has(sub.id))
      .map((sub) => ({ ...sub, visibleIfFormula: undefined })),
  };
};

const drawnAnswer = (
  field: AnyField | undefined,
  value: FormValue,
): FormValue =>
  field?.kind === "list"
    ? drawnCards(field, value).map((card) =>
        Object.fromEntries(
          outputCardSubFields(field, card).map((sub) => [sub.id, card[sub.id]]),
        ),
      )
    : value;

/**
 * A saved response cut down to what its output view shows, for a viewer who
 * mustn't read the rest of it: the view's visible blocks, the fields they draw
 * and those fields' answers, with variables already filled in and no
 * visibility conditions left to evaluate. Resolving it gives the items the
 * whole response would.
 */
export const redactToOutput = (
  params: ResolveOutputParams,
): {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  malformedListFieldIds: string[];
} => {
  const resolved = resolveOutputBlocks(params);
  if (!resolved) {
    return {
      schema: { pages: [], outputViews: [] },
      answers: {},
      malformedListFieldIds: [],
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
  const blocks = visibleBlocks.map((block) => ({
    ...("kind" in block
      ? interpolateDisplayBlock(block, variableValues)
      : interpolateOutputFieldBlock(block, variableValues)),
    visibleIfFormula: undefined,
  }));
  const fieldIds = blockFieldIds(visibleBlocks);
  const fields = fieldIds.flatMap((fieldId) => {
    const field = fieldLookup.get(fieldId);
    return field
      ? [drawnField(interpolateFieldText(field, variableValues))]
      : [];
  });
  return {
    schema: {
      pages: [{ id: "output", fields }],
      outputViews: [{ ...selectedView, blocks }],
      variables: [],
    },
    answers: Object.fromEntries(
      fieldIds.flatMap((fieldId) =>
        fieldId in answers
          ? [[fieldId, drawnAnswer(fieldLookup.get(fieldId), answers[fieldId])]]
          : [],
      ),
    ),
    malformedListFieldIds,
  };
};
