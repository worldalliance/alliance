import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  canvasOrder,
  fromSelectionMenu,
  heading,
  searchElements,
  selectElement,
} from "../../../../lib/testing/formCanvas";
import { renderFormBuilder } from "../../../../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const shown = {
  conditions: { c1: { kind: "hasValue", when: "town", hasValue: true } },
  formula: "c1",
} as const;

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "town", type: "input", kind: "text", label: "Town" },
        { id: "intro", type: "display", kind: "text", text: "Welcome" },
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
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const press = (name: string, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(canvasButton(name), { key, ...init });

describe("the canvas by keyboard", () => {
  it("moves the selected element with Alt and the arrows", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    press("Select Text Block: Welcome", "ArrowUp", { altKey: true });
    expect(canvasOrder().slice(0, 2)).toEqual([
      "Select Text Block: Welcome",
      "Select Text Field: Town",
    ]);
    expect(heading()).toBe("Text Block: Welcome");
  });

  it("acts only on the selection, not on an element merely focused", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    press("Select Text Block: Welcome", "Delete");
    expect(canvasOrder()).toHaveLength(4);
  });

  it("deletes the selection with Delete", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    press("Select Text Block: Welcome", "Delete");
    expect(canvasOrder()).not.toContain("Select Text Block: Welcome");
  });

  it("leaves the gaps out of the tab order", () => {
    renderFormBuilder(schema);
    for (const gap of canvas().getAllByRole("button", {
      name: "Add element here",
    })) {
      expect(gap.tabIndex).toBe(-1);
    }
  });

  it("adds below the selection, inside its visibility group", async () => {
    renderFormBuilder(schema);
    selectElement("Pet");
    fromSelectionMenu("Add element below…");
    await waitFor(() => expect(searchElements()).toBeTruthy());
    fireEvent.change(searchElements(), { target: { value: "Email" } });
    fireEvent.click(screen.getByRole("option", { name: "Email" }));
    expect(canvasOrder()).toEqual([
      "Select Text Field: Town",
      "Select Text Block: Welcome",
      "Select Text Field: Pet",
      "Select Email Field: Email Field",
      "Select Text Field: Vet",
    ]);
    expect(heading()).toBe("Email Field: Email Field");
    expect(
      screen.getByRole("region", { name: "Visibility group" }).textContent,
    ).toContain("Shared visibility · 3 elements");
  });

  it("selects an element right-clicked, for its actions", async () => {
    renderFormBuilder(schema);
    selectElement("Town");
    fireEvent.contextMenu(canvasButton("Select Text Block: Welcome"));
    const menu = await screen.findByRole("menu");
    expect(menu.textContent).toContain("Delete block");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(heading()).toBe("Text Block: Welcome");
  });
});
