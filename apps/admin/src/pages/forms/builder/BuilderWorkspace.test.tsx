import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, fireEvent, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { renderFormBuilder } from "../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [{ id: "p1", title: "One", fields: [] }],
  outputViews: [],
  aggregateViews: [],
};

it("keeps focus on the editor tab it switches to, and back", async () => {
  renderFormBuilder(schema);
  for (const name of ["Formulas", "Output views", "Rows", "Form"]) {
    const tab = screen.getByRole("tab", { name });
    tab.focus();
    await act(async () => fireEvent.click(tab));
    expect(screen.getByRole("tab", { name })).toBe(tab);
    expect(document.activeElement).toBe(tab);
  }
});
