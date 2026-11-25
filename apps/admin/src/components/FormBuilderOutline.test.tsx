import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  canvas,
  fromMainMenu,
  heading,
  inNarrowWindow,
  openSection,
  outline,
  pageTitle,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  contents,
  entries,
  entry,
  outlineSchema as schema,
} from "../lib/testing/formOutline";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";
import { spyOnReveals } from "../lib/testing/reveals";

serveApi(routes({}, () => Response.json([])));

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
    const reveals = spyOnReveals();
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
    expect(reveals.targets()).toContain(
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
    expect(settings().getByDisplayValue("p1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Move page up" }));
    expect(entries().slice(0, 2)).toEqual(["One", "Text Field: Town"]);
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
