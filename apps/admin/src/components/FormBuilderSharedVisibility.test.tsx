import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  canvas,
  canvasGroups,
  heading,
  openSection,
  outline,
  selectElement,
  selectGroup,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";
import { addRule, rule } from "./form-fields/conditions/conditionEditorTesting";

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
const selectedMembers = () => {
  openSection("Content");
  return within(settings().getByRole("list", { name: "Selected elements" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
};
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const groupSummaries = () =>
  canvasGroups().map(
    (group) =>
      within(group).getByRole("button", { name: /^Shared visibility/ })
        .textContent,
  );
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

describe("FormBuilder sharing visibility across a selection", () => {
  const differing = () =>
    schemaWith([
      text("q"),
      text("a", shownWhen("q")),
      text("b"),
      text("c", shownWhen("a")),
    ]);
  const selectAtoC = () => {
    selectElement("Label a");
    shiftSelect("Text Field: Label c");
  };

  it("lists each member's rules and shares the one chosen", () => {
    renderFormBuilder(differing());
    selectAtoC();
    expect(
      settings()
        .getAllByRole("listitem")
        .filter((item) => item.closest('[aria-label="Current visibility"]'))
        .map((item) => item.textContent),
    ).toEqual([
      "Share: shown when Label q is answeredNow on Text Field: Label a",
      'Share: shown when Label a is answeredNow on Text Field: Label cCan\'t share: Visibility of "a" depends on its own answer.',
      "Always shown now: Text Field: Label b",
    ]);
    expect(button(/^Share: shown when Label a is answered/).disabled).toBe(
      true,
    );

    fireEvent.click(button(/^Share: shown when Label q is answered/));
    expect(groupSummaries()).toEqual([
      "Shared visibility · 3 elementsShown when Label q is answered",
    ]);
    expect(heading()).toBe("Shared visibility");
    expect(button(/No changes|Save Form/).textContent).toBe("Save Form");

    fireEvent.click(button("Undo"));
    expect(canvasGroups()).toHaveLength(0);
    expect(button(/No changes|Save Form/).textContent).toBe("No changes");
    fireEvent.click(button("Redo"));
    expect(groupSummaries()).toHaveLength(1);
  });

  it("refuses a rule that would close a visibility cycle", () => {
    renderFormBuilder(
      schemaWith([
        text("a", shownWhen("z")),
        text("b"),
        text("z", shownWhen("b")),
      ]),
    );
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    const choice = button(/^Share: shown when Label z is answered/);
    expect(choice.disabled).toBe(true);
    expect(choice.textContent).toContain(
      "Can't share: Visibility conditions form a cycle: b -> z -> b.",
    );
  });

  it("opens a member chosen from the selection", () => {
    renderFormBuilder(schemaWith(["q", "a", "b"].map((id) => text(id))));
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    openSection("Content");
    fireEvent.click(
      settings().getByRole("button", { name: "Text Field: Label b" }),
    );
    expect(heading()).toBe("Text Field: Label b");
  });

  it("shares newly written rules", async () => {
    renderFormBuilder(schemaWith([text("a"), text("b")]));
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    expect(button("Share new rules").disabled).toBe(true);
    await addRule("Device");
    fireEvent.click(button("Share new rules"));
    expect(canvasGroups()).toHaveLength(1);
    expect(
      within(canvasGroups()[0]!).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
  });

  it("refuses newly written rules whose expression names a removed rule", async () => {
    renderFormBuilder(schemaWith([text("a"), text("b")]));
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    await addRule("Device");
    await addRule("Device");
    fireEvent.click(button("Edit as expression"));
    fireEvent.click(
      rule("condition2").getByRole("button", { name: "Remove rule" }),
    );
    expect(settings().getByText(/^No rule is named condition2/)).toBeTruthy();
    expect(button("Share new rules").disabled).toBe(true);
    expect(
      settings().getByText(
        "Can't share: the expression uses condition2, which no rule defines.",
      ),
    ).toBeTruthy();
  });

  it("refuses a member's rules whose expression names a missing rule", () => {
    renderFormBuilder(
      schemaWith([
        text("q"),
        text("a", {
          ...shownWhen("q"),
          formula: { op: "AND", left: "c1", right: "c9" },
        }),
        text("b"),
      ]),
    );
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    const choice = button(/^Share: shown when/);
    expect(choice.disabled).toBe(true);
    expect(choice.textContent).toContain(
      "Can't share: the expression uses c9, which no rule defines.",
    );
  });

  it("refuses newly written rules that would close a visibility cycle", async () => {
    renderFormBuilder(
      schemaWith([text("a"), text("b"), text("z", shownWhen("b"))]),
    );
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    await addRule("Answer on this form");
    fireEvent.change(screen.getByRole("combobox", { name: "Question" }), {
      target: { value: "z" },
    });
    expect(button("Share new rules").disabled).toBe(true);
    expect(
      settings().getByText(
        "Can't share: Visibility conditions form a cycle: b -> z -> b.",
      ),
    ).toBeTruthy();
  });

  it("splits a shared selection out of the group it was part of", () => {
    const X = shownWhen("q");
    renderFormBuilder(
      schemaWith([text("q"), text("a", X), text("b", X), text("c", X)]),
    );
    selectElement("Label b");
    shiftSelect("Text Field: Label c");
    fireEvent.click(button(/^Share: shown when Label q is answered/));
    expect(groupSummaries()).toEqual([
      "Shared visibility · 2 elementsShown when Label q is answered",
    ]);
  });

  it("says a selection holding a block without an id can't share", () => {
    renderFormBuilder(
      schemaWith([
        text("a"),
        { type: "display", kind: "text", text: "Legacy" },
        text("b"),
      ]),
    );
    selectElement("Label a");
    shiftSelect("Text Field: Label b");
    expect(
      settings().getByText(/^Blocks without an ID can't share visibility/)
        .textContent,
    ).toContain("Text Block: Legacy");
    expect(settings().queryByRole("button", { name: /^Share/ })).toBeNull();
  });

  it("points a selection that is already a group to its settings", () => {
    const X = shownWhen("q");
    renderFormBuilder(schemaWith([text("q"), text("a", X), text("b", X)]));
    selectGroup(canvasGroups()[0]!);
    fireEvent.click(checkbox("Label b"));
    expect(heading()).toBe("Text Field: Label a");
    shiftSelect("Text Field: Label b");
    expect(
      settings().getByText("These elements already share visibility."),
    ).toBeTruthy();
    fireEvent.click(button("Open group settings"));
    expect(heading()).toBe("Shared visibility");
  });

  it("adds a neighbor to a group under the rule chosen", () => {
    const X = shownWhen("q");
    renderFormBuilder(
      schemaWith([
        text("q"),
        text("a", X),
        text("b", X),
        text("c", shownWhen("b")),
      ]),
    );
    selectGroup(canvasGroups()[0]!);
    shiftSelect("Text Field: Label c");
    fireEvent.click(button(/^Share: shown when Label q is answered/));
    expect(groupSummaries()).toEqual([
      "Shared visibility · 3 elementsShown when Label q is answered",
    ]);
  });

  it("rejoins a split group, back to no changes", () => {
    const X = shownWhen("q");
    renderFormBuilder(
      schemaWith([text("q"), ...["a", "b", "c", "d"].map((id) => text(id, X))]),
    );
    selectGroup(canvasGroups()[0]!);
    openSection("Content");
    fireEvent.click(
      settings().getByRole("button", {
        name: "Split group before Text Field: Label c",
      }),
    );
    expect(canvasGroups()).toHaveLength(2);
    selectGroup(canvasGroups()[0]!);
    fireEvent.click(
      within(canvasGroups()[1]!).getByRole("button", {
        name: /^Shared visibility/,
      }),
      { shiftKey: true },
    );
    fireEvent.click(button(/^Share: shown when Label q is answered/));
    expect(groupSummaries()).toEqual([
      "Shared visibility · 4 elementsShown when Label q is answered",
    ]);
    expect(button(/No changes|Save Form/).textContent).toBe("No changes");
  });
});
