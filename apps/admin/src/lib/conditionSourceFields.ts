import {
  flattenPageItems,
  isFieldGroup,
  isQuestionField,
  type AnyField,
  type Page,
} from "@alliance/common/forms/form-schema";

export type ConditionSourceFields = {
  previousFields: AnyField[];
  laterFields: AnyField[];
};

/**
 * The fields a page item's visibility conditions can read: every field before
 * it in the form, and the fields after it on its own page. Neither holds the
 * item or anything nested in it.
 */
export function conditionSourceFields(params: {
  pages: Page[];
  pageIndex: number;
  parentId: string | null | undefined;
  index: number;
}): ConditionSourceFields {
  const { pages, pageIndex, parentId, index } = params;
  const items = pages[pageIndex]?.fields ?? [];
  const groupIndex =
    parentId == null
      ? -1
      : items.findIndex((item) => isFieldGroup(item) && item.id === parentId);
  const group = items[groupIndex];
  const siblings = group && isFieldGroup(group) ? group.fields : [];
  const topLevelIndex = parentId == null ? index : groupIndex;
  return {
    previousFields: [
      ...pages
        .slice(0, pageIndex)
        .flatMap((page) => flattenPageItems(page.fields)),
      ...flattenPageItems(items.slice(0, topLevelIndex)),
      ...siblings.slice(0, index),
    ].filter(isQuestionField),
    laterFields: [
      ...siblings.slice(index + 1),
      ...flattenPageItems(items.slice(topLevelIndex + 1)),
    ].filter(isQuestionField),
  };
}
