import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  canvas,
  heading,
  openSection,
  outline,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
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
      ],
    },
    {
      id: "p2",
      title: "Two",
      fields: [
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
        { id: "food", type: "input", kind: "text", label: "Food" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const entry = (name: string) => outline().getByRole("button", { name });
const entries = () =>
  outline()
    .getAllByRole("button", { name: /^(?!Contents of|Add page)/ })
    .map((button) => button.textContent);
const contents = (name: string) =>
  outline().getByRole("button", { name: `Contents of ${name}` });
const pageTitle = () =>
  screen.getByPlaceholderText<HTMLInputElement>("Page title");
const dataTransfer = () => ({ effectAllowed: "", dropEffect: "" });
/**
 * Passes over each of `path` and drops on its last, below the middle, the
 * only side happy-dom reports.
 */
const drag = (from: HTMLElement, ...path: HTMLElement[]) => {
  const transfer = dataTransfer();
  fireEvent.dragStart(from.parentElement!.parentElement!, {
    dataTransfer: transfer,
  });
  for (const over of path) fireEvent.dragOver(over, { dataTransfer: transfer });
  fireEvent.drop(path.at(-1)!, { dataTransfer: transfer });
};

describe("the form outline", () => {
  it("lists pages, the open page's elements, and its groups with their members", () => {
    renderFormBuilder(schema);
    expect(entries()).toEqual([
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
      "Two",
    ]);
    expect(contents("Two").getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(contents("Two"));
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
  });

  it("opens an element on another page, in its settings", () => {
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    fireEvent.click(entry("Text Field: Vet"));

    expect(heading()).toBe("Text Field: Vet");
    expect(
      canvas()
        .getByRole("button", { name: "Select Text Field: Vet" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(entry("Text Field: Vet").getAttribute("aria-current")).toBe("true");
    expect(scroll.mock.contexts).toContain(
      canvas().getByRole("button", { name: "Select Text Field: Vet" }),
    );
  });

  it("opens a group on its shared rule", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
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

  it("expands what holds a selection made on the canvas", () => {
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
    renderFormBuilder(schema);
    fireEvent.click(entry("Two"));
    fireEvent.click(contents("Shared visibility · 2 elements"));
    fireEvent.click(contents("Two"));
    expect(outline().queryByRole("button", { name: "Text Field: Pet" })).toBe(
      null,
    );

    selectElement("Pet");
    expect(entry("Text Field: Pet").getAttribute("aria-current")).toBe("true");
    expect(scroll.mock.contexts).toContain(entry("Text Field: Pet"));
  });

  it("adds a page, opening it with its title focused", async () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Add page"));
    await act(async () => {});
    expect(entries().at(-1)).toBe("Page 3");
    expect(document.activeElement).toBe(pageTitle());
    expect(pageTitle().value).toBe("Page 3");
  });

  it("moves the open page with its keyboard controls, keeping it open", () => {
    renderFormBuilder(schema);
    const up = screen.getByRole("button", { name: "Move page up" });
    expect(up.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Move page down" }));
    expect(entries()).toEqual([
      "Two",
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
    expect(pageTitle().value).toBe("One");
    openSection("Advanced");
    expect(settings().getByText("p1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Move page up" }));
    expect(entries().slice(0, 2)).toEqual(["One", "Text Field: Town"]);
  });

  it("moves a page dropped on another", () => {
    renderFormBuilder(schema);
    drag(entry("One"), entry("Two").closest("li")!);
    expect(entries()).toEqual([
      "Two",
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
    expect(pageTitle().value).toBe("One");
  });

  it("moves a page dropped while passing over an open page's elements", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    drag(
      entry("One"),
      entry("Two").closest("li")!,
      entry("Text Field: Food").closest("li")!,
    );
    expect(entries()[0]).toBe("Two");
  });

  it("moves an element within its page, even one not open", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    drag(entry("Text Field: Pet"), entry("Text Field: Vet").closest("li")!);
    expect(entries().slice(4)).toEqual([
      "Shared visibility · 2 elements",
      "Text Field: Vet",
      "Text Field: Pet",
      "Text Field: Food",
    ]);
    expect(pageTitle().value).toBe("One");
  });

  it("keeps an element from dropping onto another page", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    drag(
      entry("Text Field: Town"),
      entry("Text Block: Welcome").closest("li")!,
      entry("Text Field: Pet").closest("li")!,
    );
    expect(entries().slice(1, 3)).toEqual([
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
  });

  it("moves an element within a page whose id is pages", () => {
    renderFormBuilder({
      ...schema,
      pages: [{ ...schema.pages[0]!, id: "pages" }, schema.pages[1]!],
    });
    drag(
      entry("Text Field: Town"),
      entry("Text Block: Welcome").closest("li")!,
    );
    drag(entry("Text Field: Town"), entry("Two").closest("li")!);
    expect(entries()).toEqual([
      "One",
      "Text Block: Welcome",
      "Text Field: Town",
      "Two",
    ]);
  });
});

describe("the form outline in a narrow window", () => {
  const happyDOMKey: string = "happyDOM";
  const happyDOM = Reflect.get(window, happyDOMKey);
  beforeEach(() => happyDOM.setViewport({ width: 800 }));
  afterEach(() => happyDOM.setViewport({ width: 1024 }));

  it("opens as a drawer that closes on a choice, opening its settings", () => {
    renderFormBuilder(schema);
    expect(screen.queryByLabelText("Outline")).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: "Open outline" }));
    const drawer = screen.getByRole("complementary", { name: "Outline" });
    expect(drawer.contains(document.activeElement)).toBe(true);

    fireEvent.click(entry("Text Block: Welcome"));
    expect(screen.queryByLabelText("Outline")).toBe(null);
    expect(heading()).toBe("Text Block: Welcome");
  });

  it("closes on Escape, returning focus", () => {
    renderFormBuilder(schema);
    const open = screen.getByRole("button", { name: "Open outline" });
    open.focus();
    fireEvent.click(open);
    fireEvent.keyDown(screen.getByRole("complementary", { name: "Outline" }), {
      key: "Escape",
    });
    expect(screen.queryByLabelText("Outline")).toBe(null);
    expect(document.activeElement).toBe(open);
  });

  it("closes when settings open", () => {
    renderFormBuilder(schema);
    fireEvent.click(screen.getByRole("button", { name: "Open outline" }));
    selectElement("Town");
    expect(screen.queryByLabelText("Outline")).toBe(null);
    expect(heading()).toBe("Text Field: Town");
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
