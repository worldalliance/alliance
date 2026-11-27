import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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

const canvasPane = () => screen.getByRole("region", { name: "Form canvas" });

/** Scrolls the canvas once its page has settled, as a reader can. */
async function scrollSettledCanvas(to: number) {
  await waitFor(() =>
    expect(canvasPane().querySelector('[aria-busy="false"]')).not.toBeNull(),
  );
  const pane = canvasPane();
  pane.scrollTop = to;
  fireEvent.scroll(pane);
  return pane;
}

describe("the canvas pane", () => {
  it("opens Preview at its top and returns Edit to where it was", async () => {
    renderFormBuilder(schema);
    const pane = await scrollSettledCanvas(700);

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Preview" })),
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Preview" }).scrollTop).toBe(0),
    );
    pane.scrollTop = 50;
    fireEvent.scroll(pane);

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Edit" })),
    );
    await waitFor(() => expect(pane.scrollTop).toBe(700));
  });

  it("returns to where it was after another editor tab", async () => {
    renderFormBuilder(schema);
    await scrollSettledCanvas(700);

    await act(async () =>
      fireEvent.click(screen.getByRole("tab", { name: "Formulas" })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("tab", { name: "Form" })),
    );
    await waitFor(() => expect(canvasPane().scrollTop).toBe(700));
  });
});
