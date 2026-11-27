import type { FormSchema } from "@alliance/common/forms/form-schema";
import { outline } from "./formCanvas";

const shown = {
  conditions: { c1: { kind: "hasValue", when: "town", hasValue: true } },
  formula: "c1",
} as const;

/** Page One holds Town and Welcome; Two a shared-visibility group, Pet and Vet, then Food. */
export const outlineSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "town", type: "input", kind: "text", label: "Town" },
        { id: "intro", type: "display", kind: "text", text: "Welcome" },
      ],
    },
    {
      id: "p2",
      title: "Two",
      fields: [
        {
          id: "pet",
          type: "input",
          kind: "text",
          label: "Pet",
          visibleIfFormula: shown,
        },
        {
          id: "vet",
          type: "input",
          kind: "text",
          label: "Vet",
          visibleIfFormula: shown,
        },
        { id: "food", type: "input", kind: "text", label: "Food" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

export const entry = (name: string | RegExp) =>
  outline().getByRole("treeitem", { name });
export const entries = () =>
  outline()
    .getAllByRole("treeitem")
    .map((row) => row.getAttribute("aria-label"));
/** The chevron that shows or hides what the entry named `name` holds. */
export const contents = (name: string | RegExp) => {
  const toggle = entry(name).querySelector<HTMLElement>("[data-toggle]");
  if (!toggle) throw new Error(`${String(name)} holds nothing to show`);
  return toggle;
};
