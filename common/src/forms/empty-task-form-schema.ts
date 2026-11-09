import type { FormSchema } from "./form-schema";

export const emptyTaskFormSchema = (): FormSchema => ({
  description: "",
  pages: [{ id: "page-1", title: "Page 1", fields: [] }],
  submit: { label: "Complete" },
  outputViews: [],
  aggregateViews: [],
});
