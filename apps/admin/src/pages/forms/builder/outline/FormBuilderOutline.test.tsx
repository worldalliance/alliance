import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  canvas,
  fromMainMenu,
  fromSelectionMenu,
  heading,
  inNarrowWindow,
  openSection,
  outline,
  pageTitle,
  selectElement,
  selectionMenuState,
  settings,
} from "../../../../lib/testing/formCanvas";
import {
  contents,
  entries,
  entry,
  outlineSchema as schema,
} from "../../../../lib/testing/formOutline";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../../../../lib/testing/renderFormBuilder";
import { spyOnReveals } from "../../../../lib/testing/reveals";

serveApi(routes({}, () => Response.json([])));

const key = (name: string, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(entry(name), { key, ...init });

describe("the form outline", () => {
  it("lists pages with their elements, and groups with their members", () => {
    renderFormBuilder(schema);
    expect(entries()).toEqual([
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
    ]);
    expect(entry("Two").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(contents("Two"));
    expect(entry("Two").getAttribute("aria-expanded")).toBe("false");
    expect(entries()).toEqual([
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
      "Two",
    ]);
  });

  it("opens an element on another page, in its settings", async () => {
    const reveals = spyOnReveals();
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Vet"));
    expect(heading()).toBe("Text Field: Vet");
    expect(
      canvas()
        .getByRole("button", { name: "Select Text Field: Vet" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(entry("Text Field: Vet").getAttribute("aria-current")).toBe("true");
    expect(entry("Text Field: Vet").getAttribute("aria-selected")).toBe("true");
    await waitFor(() =>
      expect(reveals.targets()).toContain(
        canvas().getByRole("button", { name: "Select Text Field: Vet" }),
      ),
    );
  });

  it("opens a group on its shared rule", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Shared visibility · 2 elements"));
    expect(heading()).toBe("Shared visibility");
    expect(
      screen
        .getByRole("tab", { name: "Conditions" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("opens a page on its settings", () => {
    renderFormBuilder(schema);
    selectElement("Town");
    fireEvent.click(entry("Two"));
    expect(heading()).toBe("Page settings");
    expect(pageTitle().value).toBe("Two");
    expect(entry("Two").getAttribute("aria-current")).toBe("true");
  });

  it("neither opens nor scrolls when the canvas selects inside a closed entry", () => {
    const reveals = spyOnReveals();
    renderFormBuilder(schema);
    fireEvent.click(entry("Two"));
    fireEvent.click(contents("Shared visibility · 2 elements"));
    reveals.clear();
    selectElement("Pet");
    expect(outline().queryByRole("treeitem", { name: "Text Field: Pet" })).toBe(
      null,
    );
    const group = entry("Shared visibility · 2 elements");
    expect(group.getAttribute("aria-description")).toBe(
      "Contains the selection",
    );
    expect(group.getAttribute("aria-selected")).toBe("false");
    expect(reveals.targets()).not.toContain(group);
  });

  it("adds a page, opening it with its title focused", async () => {
    renderFormBuilder(schema);
    fireEvent.click(outline().getByRole("button", { name: "Add page" }));
    await act(async () => {});
    expect(entries().at(-1)).toBe("Page 3");
    expect(document.activeElement).toBe(pageTitle());
    expect(pageTitle().value).toBe("Page 3");
  });

  it("moves the open page with its keyboard controls, keeping it open", () => {
    renderFormBuilder(schema);
    expect(selectionMenuState("Move page up")).toBe("disabled");

    fromSelectionMenu("Move page down");
    expect(entries()).toEqual([
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
    expect(pageTitle().value).toBe("One");
    openSection("Advanced");
    expect(settings().getByDisplayValue("p1")).toBeTruthy();

    fromSelectionMenu("Move page up");
    expect(entries().slice(0, 2)).toEqual(["One", "Text Field: Town"]);
  });
});

describe("the outline by keyboard", () => {
  it("is one tab stop, on the selection's row", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    const stops = outline()
      .getAllByRole("treeitem")
      .filter((row) => row.tabIndex === 0);
    expect(stops).toEqual([entry("Text Block: Welcome")]);
  });

  it("moves the selection with the arrows, Home and End", () => {
    renderFormBuilder(schema);
    key("One", "ArrowDown");
    expect(heading()).toBe("Text Field: Town");
    expect(document.activeElement).toBe(entry("Text Field: Town"));
    key("Text Field: Town", "End");
    expect(heading()).toBe("Text Field: Food");
    key("Text Field: Food", "ArrowUp");
    expect(heading()).toBe("Text Field: Vet");
    key("Text Field: Vet", "Home");
    expect(heading()).toBe("Page settings");
    expect(pageTitle().value).toBe("One");
  });

  it("closes, opens and steps out with ← and →", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Pet"));
    key("Text Field: Pet", "ArrowLeft");
    expect(heading()).toBe("Shared visibility");
    key("Shared visibility · 2 elements", "ArrowLeft");
    expect(
      entry("Shared visibility · 2 elements").getAttribute("aria-expanded"),
    ).toBe("false");
    key("Shared visibility · 2 elements", "ArrowRight");
    expect(
      entry("Shared visibility · 2 elements").getAttribute("aria-expanded"),
    ).toBe("true");
    key("Shared visibility · 2 elements", "ArrowRight");
    expect(heading()).toBe("Text Field: Pet");
  });

  it("extends a range with Shift and the arrows", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Vet"));
    key("Text Field: Vet", "ArrowDown", { shiftKey: true });
    expect(heading()).toBe("2 elements selected");
    expect(entry("Text Field: Food").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("moves the selection with Alt and the arrows, and deletes it with Delete", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Block: Welcome"));
    key("Text Block: Welcome", "ArrowUp", { altKey: true });
    expect(entries().slice(0, 3)).toEqual([
      "One",
      "Text Block: Welcome",
      "Text Field: Town",
    ]);
    key("Text Block: Welcome", "Delete");
    expect(entries().slice(0, 3)).toEqual(["One", "Text Field: Town", "Two"]);
  });
});

describe("the form outline in a narrow window", () => {
  inNarrowWindow();
  afterEach(() => localStorage.removeItem("builder.outlineHidden"));

  it("starts hidden, shows from the More menu, and leaves settings beside the canvas", () => {
    renderFormBuilder(schema);
    expect(screen.queryByLabelText("Outline")).toBe(null);
    expect(heading()).toBe("Page settings");

    fromMainMenu("Show outline");
    fireEvent.click(entry("Text Block: Welcome"));
    expect(screen.getByLabelText("Outline")).toBeTruthy();
    expect(heading()).toBe("Text Block: Welcome");

    fromMainMenu("Hide outline");
    expect(screen.queryByLabelText("Outline")).toBe(null);
  });
});

it("lists a display-only form's blocks, without pages", () => {
  renderDisplayOnlyBuilder({
    pages: [
      {
        id: "p1",
        fields: [{ id: "h", type: "display", kind: "header", text: "News" }],
      },
    ],
    outputViews: [],
  });
  expect(entries()).toEqual(["Header Block: News"]);
  expect(outline().queryByRole("button", { name: "Add page" })).toBe(null);
  fireEvent.click(entry("Header Block: News"));
  expect(heading()).toBe("Header Block: News");
  expect(
    canvas()
      .getByRole("button", { name: "Select Header Block: News" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});
