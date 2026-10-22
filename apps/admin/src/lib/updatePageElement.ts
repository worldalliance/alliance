import {
  fieldHasOptions,
  isQuestionField,
  type Page,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import {
  findSingleOptionValueChange,
  getUpdatedVisibilityFormula,
} from "./optionValueRename";

const applyOptionValueToConditionalVisibility = (
  fields: PageItem[],
  controllerId: string,
  previousValue: string,
  nextValue: string,
): PageItem[] => {
  let hasChanges = false;

  const nextFields = fields.map((candidate) => {
    const formulaResult = getUpdatedVisibilityFormula(
      candidate.visibleIfFormula,
      controllerId,
      previousValue,
      nextValue,
    );

    if (!formulaResult.changed) {
      return candidate;
    }

    hasChanges = true;
    return {
      ...candidate,
      ...(formulaResult.visibleIfFormula != null
        ? { visibleIfFormula: formulaResult.visibleIfFormula }
        : {}),
    };
  });

  return hasChanges ? nextFields : fields;
};

const findOptionRename = (field: PageItem, updates: Partial<PageItem>) => {
  if (
    !isQuestionField(field) ||
    !fieldHasOptions(field) ||
    !("options" in updates) ||
    !updates.options
  ) {
    return null;
  }
  const change = findSingleOptionValueChange(field.options, updates.options);
  return change && { controllerId: field.id, ...change };
};

/**
 * Applies `updates` to one element. Renaming one option's value carries the
 * rename into the visibility conditions on that page and later pages.
 */
export const updatePageElement = ({
  pages,
  pageIndex: elementPageIndex,
  index,
  updates,
}: {
  pages: Page[];
  pageIndex: number;
  index: number;
  updates: Partial<PageItem>;
}): Page[] => {
  const field = pages[elementPageIndex]?.fields[index];
  if (!field) return pages;
  const optionValueChange = findOptionRename(field, updates);

  return pages.map((page, pageIndex) => {
    if (pageIndex === elementPageIndex) {
      const updatedFields = page.fields.map((f, i) =>
        i === index ? ({ ...f, ...updates } as PageItem) : f,
      );

      if (!optionValueChange) {
        return { ...page, fields: updatedFields };
      }

      const fieldsWithUpdatedConditions =
        applyOptionValueToConditionalVisibility(
          updatedFields,
          optionValueChange.controllerId,
          optionValueChange.previousValue,
          optionValueChange.nextValue,
        );

      return { ...page, fields: fieldsWithUpdatedConditions };
    }

    if (optionValueChange && pageIndex > elementPageIndex) {
      const fieldsWithUpdatedConditions =
        applyOptionValueToConditionalVisibility(
          page.fields,
          optionValueChange.controllerId,
          optionValueChange.previousValue,
          optionValueChange.nextValue,
        );
      const pageFormulaResult = getUpdatedVisibilityFormula(
        page.visibleIfFormula,
        optionValueChange.controllerId,
        optionValueChange.previousValue,
        optionValueChange.nextValue,
      );

      if (
        fieldsWithUpdatedConditions !== page.fields ||
        pageFormulaResult.changed
      ) {
        return {
          ...page,
          ...(pageFormulaResult.changed
            ? { visibleIfFormula: pageFormulaResult.visibleIfFormula }
            : {}),
          fields: fieldsWithUpdatedConditions,
        };
      }
    }

    return page;
  });
};
