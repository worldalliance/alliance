import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  canvas,
  canvasGroups,
  heading,
  outline,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const shownWhen = (when: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "hasValue", when, hasValue: true } },
  formula: "c1",
});

const text = (id: string, visibleIfFormula?: VisibleIfFormula): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: `Label ${id}`,
  ...(visibleIfFormula ? { visibleIfFormula } : {}),
});

const schemaWith = (fields: PageItem[]): FormSchema => ({
  pages: [{ id: "p1", title: "Page 1", fields }],
  outputViews: [],
  aggregateViews: [],
});

const shiftSelect = (label: string) =>
  fireEvent.click(canvas().getByRole("button", { name: `Select ${label}` }), {
    shiftKey: true,
  });
const pressed = () =>
  canvas()
    .getAllByRole("button", { pressed: true })
    .map((button) => button.getAttribute("aria-label"));
const selectedMembers = () =>
  settings()
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const checkbox = (label: string) =>
  outline().getByRole<HTMLInputElement>("checkbox", {
    name: `Include Text Field: ${label} in the selection`,
  });

describe("FormBuilder range selection", () => {
  it("Shift-click on the canvas selects the elements between", () => {
    renderFormBuilder(schemaWith(["a", "b", "c", "d"].map((id) => text(id))));
    selectElement("Label b");
    shiftSelect("Text Field: Label d");
    expect(heading()).toBe("3 elements selected");
    expect(selectedMembers()).toEqual([
      "Text Field: Label b",
      "Text Field: Label c",
      "Text Field: Label d",
    ]);
    expect(pressed()).toEqual([
      "Select Text Field: Label b",
      "Select Text Field: Label c",
      "Select Text Field: Label d",
    ]);

    shiftSelect("Text Field: Label a");
    expect(selectedMembers()).toEqual([
      "Text Field: Label a",
      "Text Field: Label b",
    ]);

    fireEvent.click(
      settings().getByRole("button", { name: "Text Field: Label a" }),
    );
    expect(heading()).toBe("Text Field: Label a");
  });

  it("checks outline entries into a consecutive selection", () => {
    renderFormBuilder(schemaWith(["a", "b", "c", "d"].map((id) => text(id))));
    fireEvent.click(checkbox("Label a"));
    expect(heading()).toBe("Text Field: Label a");
    fireEvent.click(checkbox("Label c"));
    expect(heading()).toBe("3 elements selected");
    expect(checkbox("Label b").checked).toBe(true);
    expect(checkbox("Label b").disabled).toBe(true);
    expect(checkbox("Label d").checked).toBe(false);

    fireEvent.click(checkbox("Label a"));
    expect(selectedMembers()).toEqual([
      "Text Field: Label b",
      "Text Field: Label c",
    ]);
  });

  it("leaves Shift-click to the inline text editor", () => {
    renderFormBuilder(schemaWith(["a", "b"].map((id) => text(id))));
    selectElement("Label a");
    fireEvent.click(canvas().getByRole("button", { name: "Edit label" }));
    const editor = canvas().getByDisplayValue("Label a");
    expect(fireEvent.mouseDown(editor, { shiftKey: true })).toBe(true);
    expect(
      fireEvent.mouseDown(
        canvas().getByRole("button", { name: "Select Text Field: Label b" }),
        { shiftKey: true },
      ),
    ).toBe(false);
  });

  it("Shift-click in the outline extends the selection", () => {
    renderFormBuilder(schemaWith(["a", "b", "c"].map((id) => text(id))));
    selectElement("Label a");
    fireEvent.click(
      outline().getByRole("button", { name: "Text Field: Label c" }),
      { shiftKey: true },
    );
    expect(heading()).toBe("3 elements selected");
  });

  it("reveals the element a selection was extended to", () => {
    renderFormBuilder(schemaWith(["a", "b", "c", "d"].map((id) => text(id))));
    const onCanvas = (label: string) =>
      canvas().getByRole("button", { name: `Select Text Field: ${label}` });
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");

    selectElement("Label a");
    scroll.mockClear();
    fireEvent.click(checkbox("Label d"));
    expect(scroll.mock.contexts).toContain(onCanvas("Label d"));
    expect(scroll.mock.contexts).toContain(
      outline().getByRole("button", { name: "Text Field: Label d" }),
    );
    expect(scroll.mock.contexts).not.toContain(onCanvas("Label a"));

    selectElement("Label d");
    scroll.mockClear();
    fireEvent.click(checkbox("Label a"));
    expect(scroll.mock.contexts).toContain(onCanvas("Label a"));
    expect(scroll.mock.contexts).not.toContain(onCanvas("Label d"));
  });

  it("Shift-click on a group's header takes in the whole group", () => {
    const X = shownWhen("q");
    renderFormBuilder(
      schemaWith([text("q"), text("a", X), text("b", X), text("c")]),
    );
    selectElement("Label c");
    fireEvent.click(
      within(canvasGroups()[0]!).getByRole("button", {
        name: /^Shared visibility/,
      }),
      { shiftKey: true },
    );
    expect(selectedMembers()).toEqual([
      "Text Field: Label a",
      "Text Field: Label b",
      "Text Field: Label c",
    ]);
  });

  it("expands a collapsed group the selection reaches into", () => {
    const X = shownWhen("q");
    renderFormBuilder(
      schemaWith([text("q"), text("a", X), text("b", X), text("c")]),
    );
    selectElement("Label c");
    fireEvent.click(
      outline().getByRole("button", {
        name: /^Contents of Shared visibility/,
      }),
    );
    expect(
      outline().queryByRole("button", { name: "Text Field: Label b" }),
    ).toBeNull();
    shiftSelect("Text Field: Label b");
    expect(
      outline()
        .getByRole("button", { name: "Text Field: Label b" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("selects one element at a time in a display-only editor", () => {
    renderDisplayOnlyBuilder(
      schemaWith([
        { id: "x", type: "display", kind: "text", text: "First" },
        { id: "y", type: "display", kind: "text", text: "Second" },
      ]),
    );
    selectElement("First");
    shiftSelect("Text Block: Second");
    expect(heading()).toBe("Text Block: Second");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
