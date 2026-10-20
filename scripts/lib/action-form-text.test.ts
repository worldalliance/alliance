import { describe, expect, test } from "bun:test";
import { renderActionForm } from "./action-form-text";

function render(fields: unknown[]): string {
  return renderActionForm({
    formId: 7,
    title: "Sample form",
    schema: {
      pages: [{ id: "page-1", title: "Intro", fields }],
      submit: { label: "Complete" },
    },
  });
}

describe("renderActionForm", () => {
  test("renders the corpus grammar", () => {
    expect(
      render([
        { type: "display", kind: "header", text: "Background", level: 3 },
        { type: "display", kind: "header", text: "Defaulted" },
        {
          type: "display",
          kind: "images",
          images: [{ src: "a.webp", alt: "ignored", caption: "Map" }],
        },
        {
          type: "display",
          kind: "previousAnswer",
          title: "Last week",
          sourceFormId: 1,
          sourceFieldId: "f",
        },
        {
          type: "input",
          kind: "radio",
          label: "Pick",
          required: true,
          options: [{ label: "Yes", value: "y" }],
        },
        { type: "input", kind: "phone", label: "Phone?" },
        {
          type: "input",
          kind: "range",
          label: "Rate",
          startLabel: "Low",
          endLabel: "High",
        },
        {
          type: "input",
          kind: "list",
          label: "Plan",
          fields: [
            { type: "input", kind: "textarea", label: "Where", required: true },
          ],
        },
      ]),
    ).toBe(
      [
        "=== task form — form #7: Sample form ===",
        "--- Page 1: Intro ---",
        "### Background",
        "## Defaulted",
        "![Map](a.webp)",
        "",
        "[radio, required] Pick\n  - Yes",
        "[custom] Phone?",
        "[range] Rate\n  Low … High",
        "[list] Plan\n  [textarea, required] Where",
        "[submit] Complete\n",
      ].join("\n\n"),
    );
  });

  test("rejects an element kind it can't render", () => {
    expect(() => render([{ type: "display", kind: "carousel" }])).toThrow();
  });
});
