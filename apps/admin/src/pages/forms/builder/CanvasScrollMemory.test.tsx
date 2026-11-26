import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { renderFormBuilder } from "../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("the canvas pane", () => {
  it("opens Preview at its top and returns Edit to where it was", async () => {
    renderFormBuilder(schema);
    const pane = screen.getByRole("region", { name: "Form canvas" });
    pane.scrollTop = 700;
    fireEvent.scroll(pane);

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Preview" })),
    );
    expect(screen.getByRole("region", { name: "Preview" }).scrollTop).toBe(0);
    pane.scrollTop = 50;
    fireEvent.scroll(pane);

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Edit" })),
    );
    expect(pane.scrollTop).toBe(700);
  });
});
