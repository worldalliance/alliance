import { type DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type ListField,
  type ListSubField,
  type Page,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import {
  type Condition,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { formSchemaIds } from "./formJson";

export const createUniqueFormBuilderId = (
  prefix: "block" | "field" | "page",
  usedIds: Set<string>,
) => {
  let id = "";
  do {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
};

export const collectSchemaIds = (schema: FormSchema) =>
  new Set(formSchemaIds(schema));

const remapConditionFieldReferences = (
  condition: Condition,
  idMap: ReadonlyMap<string, string>,
): Condition => {
  switch (condition.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "hasValue": {
      if (condition.sourceFormId != null) {
        return condition;
      }
      const nextWhen = idMap.get(condition.when);
      return nextWhen ? { ...condition, when: nextWhen } : condition;
    }
    case "validator":
    case "deviceType":
    case "outputBlockVisible":
    case "userHasCity":
    case "userPropertyHasValue":
    case "firstContractSigned":
    case "completedActionCount":
      return condition;
    default:
      condition satisfies never;
      return condition;
  }
};

const remapVisibleIfFormulaFieldReferences = (
  visibleIfFormula: VisibleIfFormula | undefined,
  idMap: ReadonlyMap<string, string>,
): VisibleIfFormula | undefined => {
  if (!visibleIfFormula?.conditions) {
    return visibleIfFormula;
  }

  let changed = false;
  const conditions: Record<string, Condition> = {};
  for (const [name, condition] of Object.entries(visibleIfFormula.conditions)) {
    const nextCondition = remapConditionFieldReferences(condition, idMap);
    conditions[name] = nextCondition;
    if (nextCondition !== condition) {
      changed = true;
    }
  }

  return changed ? { ...visibleIfFormula, conditions } : visibleIfFormula;
};

const remapListFieldReferences = (
  field: ListField,
  idMap: ReadonlyMap<string, string>,
): ListField => ({
  ...field,
  visibleIfFormula: remapVisibleIfFormulaFieldReferences(
    field.visibleIfFormula,
    idMap,
  ),
  requiredIfFormula: remapVisibleIfFormulaFieldReferences(
    field.requiredIfFormula,
    idMap,
  ),
  fields: field.fields.map((subField) => remapFieldReferences(subField, idMap)),
  outputViewHiddenFieldIds: field.outputViewHiddenFieldIds
    ?.map((id) => idMap.get(id) ?? id)
    .filter((id, index, ids) => ids.indexOf(id) === index),
  prefillFromPreviousAnswer: field.prefillFromPreviousAnswer
    ? {
        ...field.prefillFromPreviousAnswer,
        targetSubFieldId:
          idMap.get(field.prefillFromPreviousAnswer.targetSubFieldId) ??
          field.prefillFromPreviousAnswer.targetSubFieldId,
      }
    : undefined,
});

const remapFieldReferences = <T extends AnyField>(
  field: T,
  idMap: ReadonlyMap<string, string>,
): T => {
  if ("fields" in field) {
    return remapListFieldReferences(field, idMap) as T;
  }
  return {
    ...field,
    visibleIfFormula: remapVisibleIfFormulaFieldReferences(
      field.visibleIfFormula,
      idMap,
    ),
    requiredIfFormula: remapVisibleIfFormulaFieldReferences(
      field.requiredIfFormula,
      idMap,
    ),
  };
};

const copyNestedBlockIds = (
  block: DisplayBlock,
  usedIds: Set<string>,
): DisplayBlock =>
  block.kind === "accordion"
    ? {
        ...block,
        sections: block.sections.map((section) => ({
          ...section,
          id: createUniqueFormBuilderId("block", usedIds),
          blocks: section.blocks.map((nested) => ({
            ...nested,
            id: createUniqueFormBuilderId("block", usedIds),
          })),
        })),
      }
    : block;

const remapDisplayBlockReferences = (
  block: DisplayBlock,
  idMap: ReadonlyMap<string, string>,
): DisplayBlock => ({
  ...block,
  visibleIfFormula: remapVisibleIfFormulaFieldReferences(
    block.visibleIfFormula,
    idMap,
  ),
});

const remapCopiedPageReferences = (
  page: Page,
  idMap: ReadonlyMap<string, string>,
): Page => ({
  ...page,
  fields: page.fields.map((element) =>
    isQuestionField(element)
      ? remapFieldReferences(element, idMap)
      : remapDisplayBlockReferences(element, idMap),
  ),
});

const assignCopiedFieldIds = <T extends AnyField>(
  field: T,
  usedIds: Set<string>,
  idMap: Map<string, string>,
): T => {
  const nextId = createUniqueFormBuilderId("field", usedIds);
  idMap.set(field.id, nextId);

  if ("fields" in field) {
    return {
      ...field,
      id: nextId,
      fields: field.fields.map((subField) =>
        assignCopiedFieldIds(subField, usedIds, idMap),
      ) as ListSubField[],
    };
  }

  return { ...field, id: nextId };
};

export const copyPageWithUniqueIds = (page: Page, schema: FormSchema): Page => {
  const usedIds = collectSchemaIds(schema);
  const idMap = new Map<string, string>();
  const copiedPage = structuredClone(page);
  const copyPageId = createUniqueFormBuilderId("page", usedIds);
  idMap.set(page.id, copyPageId);

  const assignCopiedElementIds = (elements: Page["fields"]): Page["fields"] =>
    elements.map((element) => {
      if (isQuestionField(element)) {
        return assignCopiedFieldIds(element, usedIds, idMap);
      }

      const nextId = createUniqueFormBuilderId("block", usedIds);
      if (element.id) {
        idMap.set(element.id, nextId);
      }
      return copyNestedBlockIds({ ...element, id: nextId }, usedIds);
    });

  const pageWithCopiedIds: Page = {
    ...copiedPage,
    id: copyPageId,
    title: copiedPage.title ? `${copiedPage.title} (Copy)` : "Copied page",
    fields: assignCopiedElementIds(copiedPage.fields),
  };

  return remapCopiedPageReferences(pageWithCopiedIds, idMap);
};

export const copyElementWithUniqueIds = (
  element: PageItem,
  schema: FormSchema,
): PageItem => {
  const usedIds = collectSchemaIds(schema);
  const idMap = new Map<string, string>();
  const cloned = structuredClone(element);

  if (isQuestionField(cloned)) {
    // Only ids inside the copied field (itself + list sub-fields) are
    // remapped; references to other fields keep pointing at the originals.
    return remapFieldReferences(
      assignCopiedFieldIds(cloned, usedIds, idMap),
      idMap,
    );
  }

  return copyNestedBlockIds(
    { ...cloned, id: createUniqueFormBuilderId("block", usedIds) },
    usedIds,
  );
};
