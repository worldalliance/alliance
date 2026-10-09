import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  canvasButton,
  canvasOrder,
  heading,
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { nestedSchema, subFieldOrder } from "../lib/testing/nestedForm";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

describe("a container's settings", () => {
  it("lists its children as rows to select and reorder", () => {
    renderFormBuilder(nestedSchema);
    selectElement("List Field: Kids");
    fireEvent.click(
      settings().getByRole("button", { name: "Move Text Field: Name down" }),
    );
    expect(subFieldOrder()).toEqual([
      "Select Number Field: Age",
      "Select Text Field: Name",
    ]);

    fireEvent.click(
      settings().getByRole("button", { name: "Text Field: Name" }),
    );
    expect(heading()).toBe("Text Field: Name");
    fireEvent.click(
      settings().getByRole("button", { name: "Back to List Field: Kids" }),
    );
    expect(heading()).toBe("List Field: Kids");
  });

  it("selects a sub-field it adds, with its first control focused", async () => {
    renderFormBuilder(nestedSchema);
    selectElement("List Field: Kids");
    fireEvent.change(settings().getByDisplayValue("+ Add field to card"), {
      target: { value: "email" },
    });
    await act(async () => {});
    expect(heading()).toBe("Email Field: Email");
    expect(
      settings().getByRole("tabpanel").contains(document.activeElement),
    ).toBe(true);
  });

  it("moves a selected child and keeps it selected", () => {
    renderFormBuilder(nestedSchema);
    selectElement("Text Field: Name");
    fireEvent.click(settings().getByRole("button", { name: "Move down" }));
    expect(heading()).toBe("Text Field: Name");
    expect(subFieldOrder()).toEqual([
      "Select Number Field: Age",
      "Select Text Field: Name",
    ]);
  });

  it("returns to the container on deleting a child, which undo restores", () => {
    renderFormBuilder(nestedSchema);
    selectElement("Text Field: Name");
    openSection("Advanced");
    fireEvent.click(
      settings().getByRole("button", { name: "Delete question" }),
    );
    expect(heading()).toBe("List Field: Kids");
    expect(subFieldOrder()).toEqual(["Select Number Field: Age"]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(subFieldOrder()).toEqual([
      "Select Text Field: Name",
      "Select Number Field: Age",
    ]);
  });

  it("deletes a sub-field it has no editor for", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "kids",
              type: "input",
              kind: "list",
              label: "Kids",
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
                {
                  id: "share",
                  type: "input",
                  kind: "custom",
                  componentId: "share-url",
                  label: "Share",
                },
              ],
            },
          ],
        },
      ],
    });
    selectElement("List Field: Kids");
    fireEvent.click(settings().getByRole("button", { name: /Share$/ }));
    expect(
      settings().getByText("No settings to edit for this kind of question."),
    ).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Conditions" })).toBeNull();
    openSection("Advanced");
    fireEvent.click(
      settings().getByRole("button", { name: "Delete question" }),
    );
    expect(heading()).toBe("List Field: Kids");
    expect(subFieldOrder()).toEqual(["Select Text Field: Name"]);
  });

  it("moves a selected id-less section and keeps it selected", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [
                { title: "Shipping", blocks: [] },
                { title: "Returns", blocks: [] },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Select Section: Returns"));
    fireEvent.click(settings().getByRole("button", { name: "Move up" }));
    expect(heading()).toBe("Section: Returns");
    expect(canvasOrder(/^Select Section/)).toEqual([
      "Select Section: Returns",
      "Select Section: Shipping",
    ]);
  });

  it("edits a block's content from its own settings, leaving its siblings", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s1",
                  title: "Shipping",
                  blocks: [
                    { id: "a", type: "display", kind: "text", text: "First" },
                    { id: "b", type: "display", kind: "text", text: "Second" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: Second"));
    fireEvent.change(settings().getByPlaceholderText("Enter text content"), {
      target: { value: "Updated" },
    });
    expect(heading()).toBe("Text Block: Updated");
    expect(canvasOrder(/^Select Text Block/)).toEqual([
      "Select Text Block: First",
      "Select Text Block: Updated",
    ]);
  });

  it("adds and reorders an accordion's sections and blocks from its rows", async () => {
    renderFormBuilder(nestedSchema);
    selectElement("Accordion Block: Shipping, Returns");
    fireEvent.click(
      settings().getByRole("button", { name: "Move Section: Returns up" }),
    );
    expect(canvasOrder(/^Select Section/)).toEqual([
      "Select Section: Returns",
      "Select Section: Shipping",
    ]);

    fireEvent.change(
      settings().getByRole("combobox", { name: "Add block to Returns" }),
      { target: { value: "label" } },
    );
    await act(async () => {});
    expect(heading()).toBe("Label Block: Label text");
    expect(
      settings().getByRole("tabpanel").contains(document.activeElement),
    ).toBe(true);

    fireEvent.click(
      settings().getByRole("button", {
        name: "Back to Accordion Block: Returns, Shipping",
      }),
    );
    fireEvent.click(settings().getByRole("button", { name: "Add section" }));
    expect(heading()).toBe("Section: Section title");
  });

  it("moves and deletes an accordion's block from its own settings", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s1",
                  title: "Shipping",
                  blocks: [
                    { id: "a", type: "display", kind: "text", text: "First" },
                    { id: "b", type: "display", kind: "text", text: "Second" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: First"));
    fireEvent.click(settings().getByRole("button", { name: "Move down" }));
    expect(heading()).toBe("Text Block: First");
    expect(canvasOrder(/^Select Text Block/)).toEqual([
      "Select Text Block: Second",
      "Select Text Block: First",
    ]);

    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete block" }));
    expect(heading()).toBe("Section: Shipping");
    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete section" }));
    expect(heading()).toBe("Accordion Block");
  });

  it("returns to the container on deleting an id-less child, not its sibling", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  title: "Shipping",
                  blocks: [
                    { type: "display", kind: "text", text: "First" },
                    { type: "display", kind: "text", text: "Second" },
                  ],
                },
                { title: "Returns", blocks: [] },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: First"));
    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete block" }));
    expect(heading()).toBe("Section: Shipping");

    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete section" }));
    expect(heading()).toBe("Accordion Block: Returns");
  });
});
