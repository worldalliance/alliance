import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        {
          id: "kids",
          type: "input",
          kind: "list",
          label: "Kids",
          fields: [
            { id: "name", type: "input", kind: "text", label: "Name" },
            { id: "age", type: "input", kind: "number", label: "Age" },
          ],
        },
        {
          id: "faq",
          type: "display",
          kind: "accordion",
          sections: [
            {
              id: "s1",
              title: "Shipping",
              blocks: [
                { id: "t1", type: "display", kind: "text", text: "Ships fast" },
              ],
            },
            { id: "s2", title: "Returns", blocks: [] },
          ],
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const heading = () => settings().getAllByRole("heading")[0]?.textContent;
const rowOrder = (pattern: RegExp) =>
  settings()
    .getAllByTitle(pattern)
    .map((row) => row.title);
const subFieldRows = () => rowOrder(/^(Text|Number) Field: /);
const selectChild = (container: string, child: string) => {
  selectElement(container);
  fireEvent.click(settings().getByRole("button", { name: child }));
};

describe("a container's settings", () => {
  it("lists its children as rows to select and reorder", () => {
    renderFormBuilder(schema);
    selectElement("List Field: Kids");
    fireEvent.click(
      settings().getByRole("button", { name: "Move Text Field: Name down" }),
    );
    expect(subFieldRows()).toEqual(["Number Field: Age", "Text Field: Name"]);

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
    renderFormBuilder(schema);
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
    renderFormBuilder(schema);
    selectChild("List Field: Kids", "Text Field: Name");
    fireEvent.click(settings().getByRole("button", { name: "Move down" }));
    expect(heading()).toBe("Text Field: Name");
    selectElement("List Field: Kids");
    expect(subFieldRows()).toEqual(["Number Field: Age", "Text Field: Name"]);
  });

  it("returns to the container on deleting a child, which undo restores", () => {
    renderFormBuilder(schema);
    selectChild("List Field: Kids", "Text Field: Name");
    openSection("Advanced");
    fireEvent.click(
      settings().getByRole("button", { name: "Delete question" }),
    );
    expect(heading()).toBe("List Field: Kids");
    expect(subFieldRows()).toEqual(["Number Field: Age"]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(subFieldRows()).toEqual(["Text Field: Name", "Number Field: Age"]);
  });

  it("deletes a sub-field it has no editor for", () => {
    renderFormBuilder({
      ...schema,
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
    expect(subFieldRows()).toEqual(["Text Field: Name"]);
  });

  it("renames a section from its settings", () => {
    renderFormBuilder(schema);
    selectChild("Accordion Block: Shipping, Returns", "Section: Returns");
    expect(heading()).toBe("Section: Returns");
    fireEvent.change(
      settings().getByRole("textbox", { name: "Section title" }),
      {
        target: { value: "Refunds" },
      },
    );
    expect(heading()).toBe("Section: Refunds");
  });

  it("moves a selected id-less section and keeps it selected", () => {
    renderFormBuilder({
      ...schema,
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
    selectChild("Accordion Block: Shipping, Returns", "Section: Returns");
    fireEvent.click(settings().getByRole("button", { name: "Move up" }));
    expect(heading()).toBe("Section: Returns");
    selectElement("Accordion Block: Returns, Shipping");
    expect(rowOrder(/^Section: /)).toEqual([
      "Section: Returns",
      "Section: Shipping",
    ]);
  });

  it("edits a block's content from its own settings, leaving its siblings", () => {
    renderFormBuilder({
      ...schema,
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
    selectChild("Accordion Block: Shipping", "Text Block: Second");
    fireEvent.change(settings().getByPlaceholderText("Enter text content"), {
      target: { value: "Updated" },
    });
    expect(heading()).toBe("Text Block: Updated");
    selectElement("Accordion Block: Shipping");
    expect(rowOrder(/^Text Block: /)).toEqual([
      "Text Block: First",
      "Text Block: Updated",
    ]);
  });

  it("adds and reorders an accordion's sections and blocks from its rows", async () => {
    renderFormBuilder(schema);
    selectElement("Accordion Block: Shipping, Returns");
    fireEvent.click(
      settings().getByRole("button", { name: "Move Section: Returns up" }),
    );
    expect(rowOrder(/^Section: /)).toEqual([
      "Section: Returns",
      "Section: Shipping",
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
      ...schema,
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
    selectChild("Accordion Block: Shipping", "Text Block: First");
    fireEvent.click(settings().getByRole("button", { name: "Move down" }));
    expect(heading()).toBe("Text Block: First");
    selectElement("Accordion Block: Shipping");
    expect(rowOrder(/^Text Block: /)).toEqual([
      "Text Block: Second",
      "Text Block: First",
    ]);
    fireEvent.click(
      settings().getByRole("button", { name: "Text Block: First" }),
    );

    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete block" }));
    expect(heading()).toBe("Section: Shipping");
    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete section" }));
    expect(heading()).toBe("Accordion Block");
  });

  it("returns to the container on deleting an id-less child, not its sibling", () => {
    renderFormBuilder({
      ...schema,
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
    selectChild("Accordion Block: Shipping, Returns", "Text Block: First");
    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete block" }));
    expect(heading()).toBe("Section: Shipping");

    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name: "Delete section" }));
    expect(heading()).toBe("Accordion Block: Returns");
  });
});
