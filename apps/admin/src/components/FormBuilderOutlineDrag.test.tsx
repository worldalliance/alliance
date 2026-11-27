import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
import { dragOverAt } from "../lib/testing/dragOverAt";
import { heading, outline, pageTitle } from "../lib/testing/formCanvas";
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

serveApi(routes({}, () => Response.json([])));

/** An entry's own row, without its open contents. */
const row = (name: string) => entry(name).parentElement!.parentElement!;
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

/** Page Two holds a list, People, with one sub-field, Name, then Food. */
const withList: FormSchema = {
  ...schema,
  pages: [
    schema.pages[0]!,
    {
      id: "p2",
      title: "Two",
      fields: [
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
        },
        { id: "food", type: "input", kind: "text", label: "Food" },
      ],
    },
  ],
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
    drag(entry("Text Field: Pet"), row("Text Field: Vet"));
    expect(entries().slice(4)).toEqual([
      "Shared visibility · 2 elements",
      "Text Field: Vet",
      "Text Field: Pet",
      "Text Field: Food",
    ]);
    expect(pageTitle().value).toBe("One");
  });

  it("moves an element to a gap on another page", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    drag(entry("Text Field: Town"), row("Text Field: Food"));
    expect(entries()).toEqual([
      "One",
      "Text Block: Welcome",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
      "Text Field: Town",
    ]);
    expect(pageTitle().value).toBe("One");
  });

  it("moves an element dropped above another's middle to before it", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    const transfer = dataTransfer();
    fireEvent.dragStart(row("Text Field: Town"), { dataTransfer: transfer });
    dragOverAt(row("Text Field: Food"), -1);
    fireEvent.drop(row("Text Field: Food"), { dataTransfer: transfer });
    expect(entries().slice(3)).toEqual([
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Town",
      "Text Field: Food",
    ]);
  });

  it("moves an element dropped on a page's row to that page's end", () => {
    renderFormBuilder(schema);
    drag(entry("Text Field: Town"), row("Two"));
    fireEvent.click(contents("Two"));
    expect(entries().slice(1)).toEqual([
      "Text Block: Welcome",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
      "Text Field: Town",
    ]);
  });

  it("moves the selected elements together, keeping them selected on their new page", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Town"));
    fireEvent.click(entry("Text Block: Welcome"), { shiftKey: true });
    drag(entry("Text Block: Welcome"), row("Two"));
    expect(entries()).toEqual([
      "One",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
    for (const name of ["Text Field: Town", "Text Block: Welcome"]) {
      expect(entry(name).getAttribute("aria-current")).toBe("true");
    }
  });

  it("keeps focus on an element dragged to another page", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Town"));
    entry("Text Field: Town").focus();
    drag(entry("Text Field: Town"), row("Two"));
    expect(document.activeElement).toBe(entry("Text Field: Town"));
  });

  it("leaves focus on the outline when a focused element moves to a page with no selected row shown", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Town"));
    fireEvent.click(contents("One"));
    fireEvent.click(contents("Two"));
    entry("Text Field: Food").focus();
    drag(entry("Text Field: Food"), row("One"));
    expect(entries()).toEqual([
      "One",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
    ]);
    const root = screen
      .getByLabelText("Outline")
      .querySelector<HTMLElement>('[tabindex="-1"]');
    expect(root).not.toBeNull();
    expect(document.activeElement).toBe(root);
  });

  it("drops nothing once an element passes off the rows onto a page's contents", () => {
    renderFormBuilder(schema);
    drag(
      entry("Text Field: Town"),
      row("Text Block: Welcome"),
      entry("Two").closest("li")!,
    );
    expect(entries().slice(1, 3)).toEqual([
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
  });

  it("drops nothing once an element passes off the rows onto an open list's contents", () => {
    renderFormBuilder(withList);
    fireEvent.click(contents("Two"));
    fireEvent.click(contents("List Field: People"));
    drag(
      entry("Text Field: Town"),
      row("List Field: People"),
      entry("Text Field: Name").closest("li")!,
    );
    expect(entries().slice(0, 2)).toEqual(["One", "Text Field: Town"]);
  });

  it("moves an element dropped on an open list's row to before the list", () => {
    renderFormBuilder(withList);
    fireEvent.click(contents("Two"));
    fireEvent.click(contents("List Field: People"));
    const transfer = dataTransfer();
    fireEvent.dragStart(row("Text Field: Town"), { dataTransfer: transfer });
    dragOverAt(row("List Field: People"), 1);
    fireEvent.drop(row("List Field: People"), { dataTransfer: transfer });
    expect(entries().slice(-4)).toEqual([
      "Text Field: Town",
      "List Field: People",
      "Text Field: Name",
      "Text Field: Food",
    ]);
  });

  it("moves an element dropped low on an open list last on its page to the page's end", () => {
    renderDisplayOnlyBuilder({
      ...schema,
      pages: [
        {
          ...withList.pages[1]!,
          fields: [...withList.pages[1]!.fields].reverse(),
        },
      ],
    });
    fireEvent.click(contents("List Field: People"));
    drag(entry("Text Field: Food"), row("List Field: People"));
    expect(entries()).toEqual([
      "List Field: People",
      "Text Field: Name",
      "Text Field: Food",
    ]);
  });

  it("moves an element dropped low on an open list last on its page to before the list, as the page's row takes the page's end", () => {
    renderFormBuilder({
      ...withList,
      pages: [
        withList.pages[0]!,
        {
          ...withList.pages[1]!,
          fields: [...withList.pages[1]!.fields].reverse(),
        },
      ],
    });
    fireEvent.click(contents("Two"));
    fireEvent.click(contents("List Field: People"));
    drag(entry("Text Field: Town"), row("List Field: People"));
    expect(entries().slice(-4)).toEqual([
      "Text Field: Food",
      "Text Field: Town",
      "List Field: People",
      "Text Field: Name",
    ]);
  });

  it("drags a collapsed group by its header", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    fireEvent.click(contents("Shared visibility · 2 elements"));
    drag(entry("Shared visibility · 2 elements"), row("Text Field: Food"));
    fireEvent.click(contents("Shared visibility · 2 elements"));
    expect(entries().slice(-4)).toEqual([
      "Text Field: Food",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
    ]);
  });

  it("drags a selected group whole, keeping it selected on its new page", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    fireEvent.click(entry("Shared visibility · 2 elements"));
    drag(entry("Text Field: Pet"), row("One"));
    expect(entries()).toEqual([
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Two",
      "Text Field: Food",
    ]);
    expect(heading()).toBe("Shared visibility");
  });

  it("leaves a selection on another page behind when an element moves", () => {
    renderFormBuilder({
      ...schema,
      pages: [...schema.pages, { id: "p3", title: "Three", fields: [] }],
    });
    fireEvent.click(entry("Text Field: Town"));
    fireEvent.click(contents("Two"));
    drag(entry("Text Field: Pet"), row("Three"));
    expect(heading()).toBe("Text Field: Town");
    expect(entry("Text Field: Town").getAttribute("aria-current")).toBe("true");
  });

  it("fades a dragged group's header with its members", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    fireEvent.click(entry("Shared visibility · 2 elements"));
    const header = row("Shared visibility · 2 elements");
    expect(header.className).not.toContain("opacity-50");
    fireEvent.dragStart(row("Text Field: Pet"), {
      dataTransfer: dataTransfer(),
    });
    expect(header.className).toContain("opacity-50");
  });

  it("drags an element outside the selection alone", () => {
    renderFormBuilder(schema);
    fireEvent.click(entry("Text Field: Town"));
    fireEvent.click(entry("Text Block: Welcome"), { shiftKey: true });
    fireEvent.click(contents("Two"));
    drag(entry("Text Field: Food"), row("Text Block: Welcome"));
    expect(entries()).toEqual([
      "One",
      "Text Field: Town",
      "Text Block: Welcome",
      "Text Field: Food",
      "Two",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
    ]);
    expect(
      ["Text Field: Town", "Text Block: Welcome", "Text Field: Food"].map(
        (name) => entry(name).getAttribute("aria-current"),
      ),
    ).toEqual(["true", "true", "false"]);
  });

  it("drops nothing once an element passes off the rows onto the pages heading", () => {
    renderFormBuilder(schema);
    drag(
      entry("Text Field: Town"),
      row("Text Block: Welcome"),
      outline().getByRole("heading", { name: "Pages" }),
    );
    expect(entries().slice(1, 3)).toEqual([
      "Text Field: Town",
      "Text Block: Welcome",
    ]);
  });

  it("drops nothing once a page passes off the rows onto the pages heading", () => {
    renderFormBuilder(schema);
    drag(
      entry("One"),
      entry("Two").closest("li")!,
      outline().getByRole("heading", { name: "Pages" }),
    );
    expect(entries()[0]).toBe("One");
  });

  it("moves an element dropped on a group's header to before the group", () => {
    renderFormBuilder(schema);
    fireEvent.click(contents("Two"));
    drag(entry("Text Field: Town"), row("Shared visibility · 2 elements"));
    expect(entries().slice(2)).toEqual([
      "Two",
      "Text Field: Town",
      "Shared visibility · 2 elements",
      "Text Field: Pet",
      "Text Field: Vet",
      "Text Field: Food",
    ]);
  });

  it("shows a drop line only where a drop moves something", () => {
    renderFormBuilder(schema);
    const linesWhile = (from: HTMLElement, over: HTMLElement) => {
      const transfer = dataTransfer();
      const handle = from.parentElement!.parentElement!;
      fireEvent.dragStart(handle, { dataTransfer: transfer });
      fireEvent.dragOver(over, { dataTransfer: transfer });
      const lines = screen
        .getByLabelText("Outline")
        .querySelectorAll(".bg-blue-500").length;
      fireEvent.dragEnd(handle);
      return lines;
    };
    expect(
      linesWhile(entry("Text Field: Town"), row("Text Block: Welcome")),
    ).toBe(1);
    expect(
      linesWhile(entry("Text Block: Welcome"), row("Text Field: Town")),
    ).toBe(0);
    expect(linesWhile(entry("One"), entry("Two").closest("li")!)).toBe(1);
    expect(linesWhile(entry("Two"), entry("One").closest("li")!)).toBe(0);
    fireEvent.click(contents("Two"));
    expect(
      linesWhile(
        entry("Text Field: Town"),
        row("Shared visibility · 2 elements"),
      ),
    ).toBe(1);
  });

  it("rings a page's row while an element dragged over it would join its end", () => {
    renderFormBuilder(schema);
    const transfer = dataTransfer();
    fireEvent.dragStart(row("Text Field: Town"), { dataTransfer: transfer });
    fireEvent.dragOver(row("Two"), { dataTransfer: transfer });
    expect(row("Two").className).toContain("after:ring-2");
    fireEvent.dragOver(row("One"), { dataTransfer: transfer });
    expect(row("One").className).toContain("after:ring-2");
    expect(row("Two").className).not.toContain("after:ring-2");
  });

  it("moves an element onto an empty page", () => {
    renderFormBuilder({
      ...schema,
      pages: [schema.pages[0]!, { id: "p3", title: "Three", fields: [] }],
    });
    fireEvent.click(contents("Three"));
    drag(entry("Text Field: Town"), outline().getByText("No elements"));
    expect(entries()).toEqual([
      "One",
      "Text Block: Welcome",
      "Three",
      "Text Field: Town",
    ]);
  });
});
