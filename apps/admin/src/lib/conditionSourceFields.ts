import {
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
 * item itself.
 */
export function conditionSourceFields(params: {
  pages: Page[];
  pageIndex: number;
  index: number;
}): ConditionSourceFields {
  const { pages, pageIndex, index } = params;
  const items = pages[pageIndex]?.fields ?? [];
  return {
    previousFields: [
      ...pages.slice(0, pageIndex).flatMap((page) => page.fields),
      ...items.slice(0, index),
    ].filter(isQuestionField),
    laterFields: items.slice(index + 1).filter(isQuestionField),
  };
}
