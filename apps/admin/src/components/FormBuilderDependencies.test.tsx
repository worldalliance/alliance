import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  heading,
  inNarrowWindow,
  openSection,
  outline,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderFormBuilder,
  renderSavedFormBuilder,
} from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const reads = (when: string, sourceFormId?: number): VisibleIfFormula => ({
  conditions: {
    c1: {
      kind: "hasValue",
      when,
      hasValue: true,
      ...(sourceFormId === undefined ? {} : { sourceFormId }),
    },
  },
  formula: "c1",
});

const text = (id: string, visibleIfFormula?: VisibleIfFormula): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: `Label ${id}`,
  ...(visibleIfFormula ? { visibleIfFormula } : {}),
});

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        text("a"),
        text("b", reads("a")),
        text("c", reads("a")),
        text("d", reads("gone")),
        text("e", reads("x", 7)),
      ],
    },
    { id: "p2", title: "Two", visibleIfFormula: reads("a"), fields: [] },
  ],
  outputViews: [],
  aggregateViews: [],
};

const listSchema: FormSchema = {
  ...schema,
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
            {
              id: "age",
              type: "input",
              kind: "number",
              label: "Age",
              visibleIfFormula: reads("name"),
            },
          ],
        },
      ],
    },
  ],
};

const savedForms: Record<string, FormSchema> = {
  1: schema,
  2: { ...listSchema, pages: [schema.pages[1]!, ...listSchema.pages] },
};

serveApi(
  routes(
    {
      "GET /tasks/slug/:id": ({ params }) =>
        Response.json({
          id: Number(params.id),
          schema: savedForms[params.id],
          formSnapshotId: 3,
        }),
    },
    () => Response.json([]),
  ),
);

const links = (label: "Depends on" | "Used by") =>
  within(settings().getByRole("list", { name: label }));
const activeSection = () =>
  settings().getByRole("tab", { selected: true }).textContent;

describe("FormBuilder dependency links", () => {
  it("goes from a dependent to its source and back to a dependent page", () => {
    renderFormBuilder(schema);
    selectElement("Label b");
    openSection("Conditions");
    fireEvent.click(
      links("Depends on").getByRole("button", { name: "Text Field: Label a" }),
    );
    expect(heading()).toBe("Text Field: Label a");
    expect(activeSection()).toBe("Conditions");

    fireEvent.click(
      links("Used by").getByRole("button", { name: "Page: Two" }),
    );
    expect(heading()).toBe("Page settings");
    expect(activeSection()).toBe("Conditions");
    expect(
      outline()
        .getByRole("button", { name: "Two" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("gathers a group's members under the group", () => {
    renderFormBuilder(schema);
    selectElement("Label a");
    openSection("Conditions");
    const group = links("Used by").getByRole("button", {
      name: "Shared visibility · 2 elements",
    });
    const members = within(
      settings().getByRole("list", { name: "Group members" }),
    );
    expect(
      members.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Text Field: Label b", "Text Field: Label c"]);

    fireEvent.click(
      members.getByRole("button", { name: "Text Field: Label c" }),
    );
    expect(heading()).toBe("Text Field: Label c");

    selectElement("Label a");
    openSection("Conditions");
    fireEvent.click(
      links("Used by").getByRole("button", {
        name: "Shared visibility · 2 elements",
      }),
    );
    expect(heading()).toBe("Shared visibility");
    expect(group.isConnected).toBe(false);
  });

  it("names a missing source and another form's source by id", () => {
    renderFormBuilder(schema);
    selectElement("Label d");
    openSection("Conditions");
    expect(links("Depends on").getByText("gone")).toBeTruthy();
    expect(links("Depends on").getByText(/Missing question/)).toBeTruthy();

    selectElement("Label e");
    openSection("Conditions");
    const source = links("Depends on").getByRole("link", {
      name: "x (form 7), opens in a new tab",
    });
    expect(source.getAttribute("href")).toBe("/forms/7?select=x");
    expect(source.getAttribute("target")).toBe("_blank");
  });

  it("selects and reveals the question a link to the form names", async () => {
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
    const router = renderSavedFormBuilder(1, "/?select=c&editor=form");
    expect(
      await screen.findByRole("heading", { name: "Text Field: Label c" }),
    ).toBeTruthy();
    expect(scroll.mock.contexts).toContain(
      canvasButton("Select Text Field: Label c"),
    );
    expect(router.state.location.search).toBe("?editor=form");
  });

  it("turns to the page of a linked list's sub-field", async () => {
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
    renderSavedFormBuilder(2, "/?select=name");
    expect(
      await screen.findByRole("heading", { name: "Text Field: Name" }),
    ).toBeTruthy();
    expect(scroll.mock.contexts).toContain(
      canvasButton("Select Text Field: Name"),
    );
  });

  describe("in a narrow window", () => {
    inNarrowWindow();

    it("opens the linked question's settings", async () => {
      renderSavedFormBuilder(1, "/?select=c");
      expect(
        await screen.findByRole("heading", { name: "Text Field: Label c" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("complementary", { name: "Settings" }),
      ).toBeTruthy();
    });
  });

  it("says when the form lacks the question a link names", async () => {
    renderSavedFormBuilder(1, "/?select=gone");
    expect(
      await screen.findByText('This form has no question "gone"'),
    ).toBeTruthy();
    expect(heading()).toBe("Page settings");
  });

  it("links a list's sub-fields to the sub-fields reading them", () => {
    renderFormBuilder(listSchema);
    selectElement("Number Field: Age");
    openSection("Conditions");
    fireEvent.click(
      links("Depends on").getByRole("button", {
        name: "List Field: Kids › Text Field: Name",
      }),
    );
    expect(heading()).toBe("Text Field: Name");
    fireEvent.click(
      links("Used by").getByRole("button", {
        name: "List Field: Kids › Number Field: Age",
      }),
    );
    expect(heading()).toBe("Number Field: Age");
  });

  it("lists what reads a sub-field without Conditions under its Content", () => {
    renderFormBuilder({
      ...schema,
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
                {
                  id: "agree",
                  type: "input",
                  kind: "contract",
                  contractId: null,
                  label: "Agree",
                  signQuestion: "Do you sign?",
                  yesLabel: "Yes",
                  noLabel: "No",
                },
                {
                  id: "age",
                  type: "input",
                  kind: "number",
                  label: "Age",
                  visibleIfFormula: reads("agree"),
                },
              ],
            },
          ],
        },
      ],
    });
    selectElement("Contract Field: Agree");
    expect(activeSection()).toBe("Content");
    expect(
      links("Used by").getByRole("button", {
        name: "List Field: Kids › Number Field: Age",
      }),
    ).toBeTruthy();
  });

  it("leaves no empty divider where there is nothing to link", () => {
    renderFormBuilder(schema);
    openSection("Conditions");
    expect(heading()).toBe("Page settings");
    expect(
      settings()
        .getByRole("tabpanel")
        .querySelector(":scope > .border-t:empty"),
    ).toBeNull();
  });

  it("says when nothing reads a question", () => {
    renderFormBuilder(schema);
    selectElement("Label e");
    openSection("Conditions");
    expect(
      screen.getByText("No conditions on this form read this question."),
    ).toBeTruthy();
  });
});

describe("FormBuilder deleting a source", () => {
  const dialog = () => within(screen.getByRole("dialog"));
  const deleteFromAdvanced = (name: string) => {
    openSection("Advanced");
    fireEvent.click(settings().getByRole("button", { name }));
  };

  it("lists what reads a question before deleting it, then undoes", () => {
    renderFormBuilder(schema);
    selectElement("Label a");
    deleteFromAdvanced("Delete question");
    expect(
      dialog().getByText(
        /Shared visibility · 2 elements: Text Field: Label b, Text Field: Label c/,
      ),
    ).toBeTruthy();
    expect(dialog().getByText(/Page: Two/)).toBeTruthy();

    fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
    expect(canvasButton("Select Text Field: Label a")).toBeTruthy();

    deleteFromAdvanced("Delete question");
    fireEvent.click(dialog().getByRole("button", { name: "Delete question" }));
    expect(
      canvas().queryByRole("button", { name: "Select Text Field: Label a" }),
    ).toBeNull();

    selectElement("Label b");
    openSection("Conditions");
    expect(links("Depends on").getByText(/Missing question/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(canvasButton("Select Text Field: Label a")).toBeTruthy();
  });

  it("deletes an unread question at once", () => {
    renderFormBuilder(schema);
    selectElement("Label e");
    deleteFromAdvanced("Delete question");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      canvas().queryByRole("button", { name: "Select Text Field: Label e" }),
    ).toBeNull();
  });

  it("lists the sub-fields reading a deleted sub-field", () => {
    renderFormBuilder(listSchema);
    selectElement("Text Field: Name");
    deleteFromAdvanced("Delete question");
    expect(
      dialog().getByText(/List Field: Kids › Number Field: Age/),
    ).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Delete question" }));
    expect(heading()).toBe("List Field: Kids");
  });

  it("names the page deletion and what outside the page reads it", () => {
    renderFormBuilder({
      ...schema,
      pages: [{ id: "p0", title: "Zero", fields: [] }, ...schema.pages],
    });
    fireEvent.click(outline().getByRole("button", { name: "One" }));
    deleteFromAdvanced("Delete page");
    expect(dialog().getByText(/Page: Two/)).toBeTruthy();
    expect(dialog().queryByText(/Label b/)).toBeNull();
    fireEvent.click(dialog().getByRole("button", { name: "Delete page" }));
    expect(outline().queryByRole("button", { name: "One" })).toBeNull();
  });
});
