import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import {
  canvasOrder,
  heading,
  insertElement,
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

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
          kind: "radio",
          label: "Pet",
          options: [{ label: "Cat", value: "cat" }],
          visibleIfFormula: {
            conditions: {
              c1: { kind: "hasValue", when: "town", hasValue: true },
            },
            formula: "c1",
          },
        },
      ],
    },
    { id: "p2", title: "Two", fields: [] },
  ],
  outputViews: [],
  aggregateViews: [],
};

const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });

describe("the form canvas", () => {
  it("starts on the first page's settings", () => {
    renderFormBuilder(schema);
    expect(heading()).toBe("Page settings");
    expect(
      screen.getByPlaceholderText<HTMLInputElement>("Page title").value,
    ).toBe("One");
  });

  it("selects a question from a click on its input, without answering it", () => {
    renderFormBuilder(schema);
    const input = screen
      .getAllByRole("textbox", { hidden: true })
      .find((box) => box.closest("[inert]"));
    if (!input) throw new Error("no inert canvas input");
    fireEvent.click(input);

    expect(heading()).toBe("Text Field: Town");
    expect(settings().getByDisplayValue("Town")).toBeTruthy();
    expect(button("Select Text Field: Town").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("opens a conditional element's Conditions from its indicator", () => {
    renderFormBuilder(schema);
    fireEvent.click(button("Edit conditions: shown when Town is answered"));
    expect(heading()).toBe("Radio Field: Pet");
    expect(
      screen
        .getByRole("tab", { name: "Conditions" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("selects what it inserts, and focuses its first control", async () => {
    renderFormBuilder(schema);
    insertElement(button("Add element"), "Email Field");
    await act(async () => {});
    expect(heading()).toBe("Email Field: Email Field");
    expect(
      settings().getByRole("tabpanel").contains(document.activeElement),
    ).toBe(true);
    expect(canvasOrder().at(-1)).toBe("Select Email Field: Email Field");
  });

  it("moves the selected element with its keyboard controls", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    fireEvent.click(button("Move down"));
    expect(canvasOrder()).toEqual([
      "Select Text Block: Welcome",
      "Select Text Field: Town",
      "Select Radio Field: Pet",
    ]);
    expect(heading()).toBe("Text Field: Town");
    expect(button("Move up").getAttribute("aria-disabled")).toBe("false");
  });

  it("moves an id-less block, keeping it selected by its new position", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            { type: "display", kind: "text", text: "Loose" },
            { id: "town", type: "input", kind: "text", label: "Town" },
          ],
        },
      ],
    });
    selectElement("Loose");
    fireEvent.click(button("Move down"));
    expect(canvasOrder()).toEqual([
      "Select Text Field: Town",
      "Select Text Block: Loose",
    ]);
    expect(heading()).toBe("Text Block: Loose");
    fireEvent.click(button("Move up"));
    expect(heading()).toBe("Text Block: Loose");
    expect(canvasOrder()[0]).toBe("Select Text Block: Loose");
  });

  it("follows a selected id-less block that another element is dragged past", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            { id: "town", type: "input", kind: "text", label: "Town" },
            { type: "display", kind: "text", text: "First" },
            { type: "display", kind: "text", text: "Second" },
          ],
        },
      ],
    });
    selectElement("First");
    const handle = within(
      button("Select Text Field: Town").parentElement!,
    ).getByTitle("Drag to reorder");
    const target = button("Select Text Block: Second").parentElement!;
    const dataTransfer = { effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: 1 });
    fireEvent.drop(target, { dataTransfer });
    expect(canvasOrder()[0]).toBe("Select Text Block: First");
    expect(heading()).toBe("Text Block: First");
  });

  it("inserts a copy of an existing element", () => {
    renderFormBuilder(schema);
    insertElement(button("Add element"), "Copy Existing Element");
    const source = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Element to copy",
    });
    fireEvent.change(source, { target: { value: "0:0" } });
    fireEvent.click(button("Insert"));
    expect(canvasOrder().at(-1)).toBe("Select Text Field: Town");
    expect(heading()).toBe("Text Field: Town");
    openSection("Advanced");
    expect(settings().queryByText("town")).toBeNull();
  });

  it("closes the picker on Escape, back on its button", () => {
    renderFormBuilder(schema);
    const add = button("Add element");
    fireEvent.click(add);
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Search elements" }),
      {
        key: "Escape",
      },
    );
    expect(screen.queryByRole("textbox", { name: "Search elements" })).toBe(
      null,
    );
    expect(document.activeElement).toBe(add);
  });

  it("steps the selected element past a whole group, keeping it intact", () => {
    const shared = {
      conditions: { c1: { kind: "userHasCity" as const, userHasCity: true } },
      formula: "c1",
    };
    const text = (id: string, visibleIfFormula?: typeof shared) => ({
      id,
      type: "input" as const,
      kind: "text" as const,
      label: `Label ${id}`,
      ...(visibleIfFormula ? { visibleIfFormula } : {}),
    });
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            text("free"),
            text("g1", shared),
            text("g2", shared),
            text("g3", shared),
          ],
        },
      ],
    });
    selectElement("Label free");
    fireEvent.click(button("Move down"));
    expect(canvasOrder()).toEqual([
      "Select Text Field: Label g1",
      "Select Text Field: Label g2",
      "Select Text Field: Label g3",
      "Select Text Field: Label free",
    ]);
    expect(
      within(
        screen.getByRole("region", { name: "Visibility group" }),
      ).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
    expect(button("Move down").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button("Move up"));
    expect(canvasOrder()[0]).toBe("Select Text Field: Label free");
  });

  it("keeps a link inside an accordion from leaving the builder", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "acc",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s",
                  title: "More",
                  blocks: [
                    {
                      id: "t",
                      type: "display",
                      kind: "text",
                      text: "[Away](https://example.com)",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(button("Contents of Section: More"));
    const link = screen.getByRole("link", { name: "Away" });
    expect(fireEvent.click(link)).toBe(false);
    expect(heading()).toBe("Text Block: [Away](https://example.com)");
  });

  it("keeps a form inside an accordion from submitting", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "acc",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s",
                  title: "More",
                  blocks: [
                    {
                      id: "h",
                      type: "display",
                      kind: "html",
                      html: '<form action="https://example.com"><button type="submit">Go</button></form>',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(button("Contents of Section: More"));
    const form = within(button("Select Accordion Block: More").parentElement!)
      .getByRole("button", { name: "Go" })
      .closest("form")!;
    expect(fireEvent.submit(form)).toBe(false);
  });

  it("opens a conditional page's Conditions from its indicator", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        schema.pages[0]!,
        {
          id: "p2",
          title: "Two",
          fields: [],
          visibleIfFormula: {
            conditions: {
              c1: { kind: "hasValue", when: "town", hasValue: true },
            },
            formula: "c1",
          },
        },
      ],
    });
    fireEvent.click(button("Two"));
    fireEvent.click(
      button("Edit page conditions: shown when Town is answered"),
    );
    expect(heading()).toBe("Page settings");
    expect(
      screen
        .getByRole("tab", { name: "Conditions" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("returns an id-less selection to the page when undo may shift it", async () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            { id: "town", type: "input", kind: "text", label: "Town" },
            { type: "display", kind: "text", text: "First" },
            { type: "display", kind: "text", text: "Second" },
          ],
        },
      ],
    });
    selectElement("Town");
    openSection("Advanced");
    fireEvent.click(button("Delete question"));
    await act(async () => {});
    selectElement("Second");
    fireEvent.click(button("Undo"));
    expect(heading()).toBe("Page settings");
  });

  it("returns to page settings' Content after deleting an id-less block", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            { type: "display", kind: "text", text: "First" },
            { type: "display", kind: "text", text: "Second" },
          ],
        },
      ],
    });
    selectElement("First");
    openSection("Advanced");
    fireEvent.click(button("Delete block"));
    expect(heading()).toBe("Page settings");
    expect(
      screen
        .getByRole("tab", { name: "Content" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("keeps focus in the sidebar when deleting from it", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    openSection("Advanced");
    const remove = button("Delete question");
    remove.focus();
    fireEvent.click(remove);
    expect(heading()).toBe("Page settings");
    expect(
      screen
        .getByRole("complementary", { name: "Settings" })
        .contains(document.activeElement),
    ).toBe(true);
  });

  it("picks the first match on Enter, and closes on a click elsewhere", () => {
    renderFormBuilder(schema);
    fireEvent.click(button("Add element"));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("textbox", { name: "Search elements" })).toBe(
      null,
    );
    fireEvent.click(button("Add element"));
    const search = screen.getByRole("textbox", { name: "Search elements" });
    fireEvent.change(search, { target: { value: "header" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(heading()).toBe("Header Block: Header Text");
  });

  it("copies on Enter in the copy picker, and Escape backs out of it", () => {
    renderFormBuilder(schema);
    insertElement(button("Add element"), "Copy Existing Element");
    const source = () =>
      screen.getByRole<HTMLSelectElement>("combobox", {
        name: "Element to copy",
      });
    fireEvent.keyDown(source(), { key: "Escape" });
    expect(
      screen.queryByRole("combobox", { name: "Element to copy" }),
    ).toBeNull();
    expect(document.activeElement).toBe(button("Add element"));

    insertElement(button("Add element"), "Copy Existing Element");
    fireEvent.change(source(), { target: { value: "0:2" } });
    fireEvent.keyDown(source(), { key: "Enter" });
    expect(canvasOrder().at(-1)).toBe("Select Radio Field: Pet");
  });

  it("moves an element dropped on another", () => {
    renderFormBuilder(schema);
    const townHandle = within(
      button("Select Text Field: Town").parentElement!,
    ).getByTitle("Drag to reorder");
    const target = button("Select Radio Field: Pet").parentElement!;
    const dataTransfer = { effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(townHandle, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: 1 });
    fireEvent.drop(target, { dataTransfer });
    expect(canvasOrder()).toEqual([
      "Select Text Block: Welcome",
      "Select Radio Field: Pet",
      "Select Text Field: Town",
    ]);
  });

  it("moves an element dropped in the gap where the drop line shows", () => {
    renderFormBuilder(schema);
    const townHandle = within(
      button("Select Text Field: Town").parentElement!,
    ).getByTitle("Drag to reorder");
    const target = button("Select Radio Field: Pet").parentElement!;
    const gap = screen.getAllByRole("button", { name: "Add element here" })[2]!
      .parentElement!;
    const dataTransfer = { effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(townHandle, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: 1 });
    expect(fireEvent.dragOver(gap, { dataTransfer })).toBe(false);
    fireEvent.drop(gap, { dataTransfer });
    expect(canvasOrder()).toEqual([
      "Select Text Block: Welcome",
      "Select Radio Field: Pet",
      "Select Text Field: Town",
    ]);
  });

  it("duplicates an element under a new id, selecting the copy", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    openSection("Advanced");
    fireEvent.click(button("Duplicate"));
    expect(canvasOrder().slice(0, 2)).toEqual([
      "Select Text Field: Town",
      "Select Text Field: Town",
    ]);
    expect(
      screen
        .getAllByRole("button", { name: "Select Text Field: Town" })[1]!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    openSection("Advanced");
    expect(settings().queryByText("town")).toBeNull();
  });

  it("returns to the page once the selected element is deleted, and back on undo", async () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    openSection("Advanced");
    fireEvent.click(button("Delete block"));
    expect(heading()).toBe("Page settings");
    await act(async () => {});
    fireEvent.click(button("Undo"));
    expect(heading()).toBe("Text Block: Welcome");
  });

  it("keeps the selection through a trip to Preview", () => {
    renderFormBuilder(schema);
    selectElement("Pet");
    fireEvent.click(button("Preview"));
    fireEvent.click(button("Edit"));
    expect(heading()).toBe("Radio Field: Pet");
  });

  it("opens a page on its settings", () => {
    renderFormBuilder(schema);
    selectElement("Pet");
    fireEvent.click(button("Two"));
    expect(heading()).toBe("Page settings");
    expect(screen.getByText(/This page is empty/)).toBeTruthy();
    fireEvent.click(button("One"));
    expect(heading()).toBe("Page settings");
  });
});

describe("the form canvas in a narrow window", () => {
  // Other tests declare `window.happyDOM` without `setViewport`.
  const happyDOMKey: string = "happyDOM";
  const happyDOM = Reflect.get(window, happyDOMKey);
  beforeEach(() => happyDOM.setViewport({ width: 800 }));
  afterEach(() => happyDOM.setViewport({ width: 1024 }));

  it("opens settings as a drawer that Escape closes, returning focus", () => {
    renderFormBuilder(schema);
    expect(screen.queryByRole("complementary", { name: "Settings" })).toBe(
      null,
    );
    const select = button("Select Text Field: Town");
    select.focus();
    fireEvent.click(select);

    const drawer = screen.getByRole("complementary", { name: "Settings" });
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(heading()).toBe("Text Field: Town");

    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Settings" })).toBe(
      null,
    );
    expect(document.activeElement).toBe(select);
    expect(select.getAttribute("aria-pressed")).toBe("true");
  });

  it("leaves the drawer open when Escape closes a menu inside it", () => {
    renderFormBuilder({
      ...schema,
      variables: [
        {
          name: "town",
          inputs: { input1: { kind: "field", fieldId: "town" } },
          formula: "input1",
        },
      ],
    });
    selectElement("Town");
    fireEvent.click(
      settings().getByRole("button", { name: "Insert a variable" }),
    );
    expect(settings().getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(settings().getByPlaceholderText("Enter field label"), {
      key: "Escape",
    });
    expect(settings().queryByRole("listbox")).toBeNull();
    expect(heading()).toBe("Text Field: Town");
  });

  it("focuses an inserted element's first control in the drawer it opens", async () => {
    renderFormBuilder(schema);
    insertElement(button("Add element"), "Email Field");
    await act(async () => {});
    expect(heading()).toBe("Email Field: Email Field");
    expect(
      settings().getByRole("tabpanel").contains(document.activeElement),
    ).toBe(true);
  });

  it("keeps Escape working after deleting from the drawer", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    openSection("Advanced");
    const remove = button("Delete question");
    remove.focus();
    fireEvent.click(remove);
    expect(heading()).toBe("Page settings");
    const drawer = screen.getByRole("complementary", { name: "Settings" });
    expect(drawer.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Settings" })).toBe(
      null,
    );
  });

  it("hands focus to the inserted element when its drawer closes", async () => {
    renderFormBuilder(schema);
    insertElement(button("Add element"), "Email Field");
    await act(async () => {});
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Settings" })).toBe(
      null,
    );
    expect(document.activeElement).toBe(
      button("Select Email Field: Email Field"),
    );
  });

  it("reopens on the current selection", () => {
    renderFormBuilder(schema);
    selectElement("Pet");
    fireEvent.click(button("Close settings"));
    fireEvent.click(button("Open settings"));
    expect(heading()).toBe("Radio Field: Pet");
  });
});

describe("the display-only canvas", () => {
  const renderDisplayOnly = () =>
    renderDisplayOnlyBuilder({
      pages: [
        {
          id: "p1",
          fields: [{ id: "h", type: "display", kind: "header", text: "News" }],
        },
      ],
      outputViews: [],
    });

  it("edits blocks without conditions, page settings, or questions", () => {
    renderDisplayOnly();
    expect(settings().getByText(/Select a block/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Page settings/ })).toBe(null);

    selectElement("News");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Content",
      "Advanced",
    ]);

    fireEvent.click(button("Add element"));
    const picker = within(
      screen.getByRole("textbox", { name: "Search elements" }).parentElement!,
    );
    expect(picker.queryByRole("button", { name: /^Text Field/ })).toBeNull();
    expect(picker.getByRole("button", { name: /^Header Block/ })).toBeTruthy();
  });
});
