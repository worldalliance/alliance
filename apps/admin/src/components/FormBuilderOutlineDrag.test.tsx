import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent } from "@testing-library/react";
import { pageTitle } from "../lib/testing/formCanvas";
import {
  contents,
  entries,
  entry,
  outlineSchema as schema,
} from "../lib/testing/formOutline";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const dataTransfer = () => ({ effectAllowed: "", dropEffect: "" });
/**
 * Passes over each of `path` and drops on its last, after its middle, since
 * the test DOM drops clientY from a drag event's init.
 */
const drag = (from: HTMLElement, ...path: HTMLElement[]) => {
  const transfer = dataTransfer();
  fireEvent.dragStart(from.parentElement!.parentElement!, {
    dataTransfer: transfer,
  });
  for (const over of path) fireEvent.dragOver(over, { dataTransfer: transfer });
  fireEvent.drop(path.at(-1)!, { dataTransfer: transfer });
};

describe("dragging in the form outline", () => {
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
