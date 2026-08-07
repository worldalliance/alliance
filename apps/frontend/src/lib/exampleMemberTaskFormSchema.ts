import type { FormSchema } from "@alliance/common/forms/form-schema";

/**
 * Static task form schema for public previews of the member task UI. This uses
 * the same schema shape produced by the admin form builder, but does not depend
 * on a saved backend form record.
 */
export const exampleMemberTaskFormSchema = {
  description: "",
  pages: [
    {
      id: "page-1",
      title: "Page 1",
      fields: [
        {
          id: "block-overview",
          type: "display",
          kind: "text",
          text: "Contact one cafe that you frequently visit and ask whether they would consider switching to compostable cups using our discount.",
        },
        {
          id: "block-script",
          type: "display",
          kind: "copytext",
          title: "Template message",
          text: "Hi! I am part of an online community asking cafes to switch to compostable cups. We can share a 20% discount with you. Is there someone I can send the details to?",
        },
        {
          id: "field-cafe-name",
          type: "input",
          kind: "text",
          label: "Enter the name of the cafe you contacted.",
          placeholder: "Neighborhood Cafe, Brooklyn, NY",
          required: true,
        },
        {
          id: "field-response",
          type: "input",
          kind: "radio",
          label: "How did they respond?",
          required: true,
          options: [
            { label: "Interested", value: "interested" },
            { label: "Not interested", value: "not-interested" },
          ],
        },
      ],
    },
  ],
  submit: { label: "Complete" },
  outputViews: [],
  aggregateViews: [],
} satisfies FormSchema;
