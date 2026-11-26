import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { renderFormBuilder } from "../../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "first", type: "input", kind: "text", label: "First" },
        { id: "last", type: "input", kind: "text", label: "Last" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const original = HTMLElement.prototype.getBoundingClientRect;
// Every pane is 400 px tall and the canvas's selected element sits far below it.
beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const below =
      this.getAttribute("aria-pressed") === "true" &&
      this.closest('[aria-label="Form canvas"]') !== null;
    return DOMRect.fromRect({ y: below ? 5000 : 0, height: below ? 40 : 400 });
  };
});
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
});

function setup() {
  renderFormBuilder(schema);
  const canvas = screen.getByRole("region", { name: "Form canvas" });
  const scrolls: (ScrollToOptions | number | undefined)[] = [];
  canvas.scrollTo = (options?: ScrollToOptions | number) => {
    scrolls.push(options);
  };
  const row = within(screen.getByRole("tree", { name: "Form outline" }))
    .getByRole("treeitem", { name: /Last/ });
  const settled = () =>
    waitFor(() =>
      expect(canvas.querySelector('[aria-busy="false"]')).not.toBeNull(),
    );
  return { scrolls, row, settled };
}

describe("selecting from the outline", () => {
  it("animates the canvas to an element below the view", async () => {
    const { scrolls, row } = setup();
    await act(async () => fireEvent.click(row));
    await waitFor(() =>
      expect(scrolls).toEqual([
        expect.objectContaining({ behavior: "smooth" }),
      ]),
    );
  });

  it("leaves the canvas where it is when a right-click opens the menu", async () => {
    const { scrolls, row, settled } = setup();
    await settled();
    await act(async () => fireEvent.contextMenu(row));
    expect(row.getAttribute("aria-selected")).toBe("true");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolls).toEqual([]);
  });
});
