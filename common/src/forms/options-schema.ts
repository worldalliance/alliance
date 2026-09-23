import z from "zod";

const optionSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
});

// An option's identity is its value (answer matching, ranking order, React
// keys), so duplicate values would make answers ambiguous.
const hasUniqueValues = (options: { value: string }[]) =>
  new Set(options.map((option) => option.value)).size === options.length;
const uniqueValuesMessage = "option values must be unique";

export const optionListSchema = z
  .array(optionSchema)
  .refine(hasUniqueValues, uniqueValuesMessage);

const categorizedOptionListSchema = z
  .array(
    z.strictObject({ ...optionSchema.shape, category: z.string().optional() }),
  )
  .refine(hasUniqueValues, uniqueValuesMessage);

const optionCategorySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
});
export type OptionCategory = z.infer<typeof optionCategorySchema>;

/**
 * Per category, why its name is invalid, or null. Names must be nonblank and
 * unique within the field, compared trimmed and case-insensitively.
 */
export function optionCategoryNameErrors(
  categories: OptionCategory[],
): (string | null)[] {
  const seen = new Set<string>();
  return categories.map(({ name }) => {
    const key = name.trim().toLowerCase();
    if (!key) return "Category names must not be blank";
    if (seen.has(key)) return "Category names must be unique within the field";
    seen.add(key);
    return null;
  });
}

export const categorizedOptionsShape = {
  options: categorizedOptionListSchema,
  categories: z.array(optionCategorySchema).optional(),
};

export function checkOptionCategories(
  field: {
    options: { category?: string }[];
    categories?: OptionCategory[];
  },
  ctx: z.RefinementCtx,
) {
  const categories = field.categories ?? [];
  const ids = new Set(categories.map((category) => category.id));
  if (ids.size !== categories.length) {
    ctx.addIssue({
      code: "custom",
      message: "category ids must be unique",
      path: ["categories"],
    });
  }
  optionCategoryNameErrors(categories).forEach((message, index) => {
    if (message) {
      ctx.addIssue({ code: "custom", message, path: ["categories", index] });
    }
  });
  field.options.forEach((option, index) => {
    if (option.category !== undefined && !ids.has(option.category)) {
      ctx.addIssue({
        code: "custom",
        message: "option category must name one of the field's categories",
        path: ["options", index, "category"],
      });
    }
  });
}
