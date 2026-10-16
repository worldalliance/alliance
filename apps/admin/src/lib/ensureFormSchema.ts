import type { FormSchema } from "@alliance/common/forms/form-schema";

export const ensureSchemaViews = (schema: FormSchema): FormSchema => ({
  ...schema,
  outputViews: schema.outputViews ?? [],
  aggregateViews: schema.aggregateViews ?? [],
});

export const ensurePages = (schema: FormSchema): FormSchema => {
  const withOutputViews = ensureSchemaViews(schema);
  if (
    !withOutputViews.pages ||
    !Array.isArray(withOutputViews.pages) ||
    withOutputViews.pages.length === 0
  ) {
    return {
      ...withOutputViews,
      pages: [{ id: "page-1", title: "Page 1", fields: [] }],
    };
  }
  return withOutputViews;
};
