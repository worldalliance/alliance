import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import {
  canvasButton,
  fromMainMenu,
  fromSelectionMenu,
  heading,
  openSection,
  selectElement,
  settings,
} from "../../../../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { type: "display", kind: "text", text: "Alpha" },
        { type: "display", kind: "text", text: "Beta" },
        { type: "display", kind: "text", text: "Gamma" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const settingsScroller = () => {
  const scroller = settings()
    .getAllByRole("heading")[0]
    ?.closest('[tabindex="-1"]');
  if (!scroller) throw new Error("no settings scroller");
  return scroller;
};

describe("the inspector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps its scroll when a block without an id moves, and scrolls up for a new selection", async () => {
    renderFormBuilder(schema);
    selectElement("Beta");
    const scroller = settingsScroller();
    scroller.scrollTop = 120;
    fromSelectionMenu("Move up");
    await act(async () => {});
    expect(scroller.scrollTop).toBe(120);
    await act(async () => selectElement("Gamma"));
    expect(scroller.scrollTop).toBe(0);
  });

  it("keeps its scroll when a section's block without an id moves", async () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [
            {
              type: "display",
              kind: "accordion",
              sections: [
                {
                  title: "Shipping",
                  blocks: [
                    { type: "display", kind: "text", text: "First" },
                    { type: "display", kind: "text", text: "Second" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: First"));
    const scroller = settingsScroller();
    scroller.scrollTop = 120;
    fromSelectionMenu("Move down");
    await act(async () => {});
    expect(heading()).toBe("Text Block: First");
    expect(scroller.scrollTop).toBe(120);
  });

  it("opens the form's settings at their top", async () => {
    renderFormBuilder(schema);
    selectElement("Beta");
    const scroller = settingsScroller();
    scroller.scrollTop = 120;
    fromMainMenu("Form settings");
    await act(async () => {});
    expect(scroller.scrollTop).toBe(0);
  });

  it("starts a tab opened while scrolled down right under the stuck tabs", async () => {
    renderFormBuilder(schema);
    selectElement("Beta");
    const scroller = settingsScroller();
    if (!(scroller instanceof HTMLElement)) throw new Error("not an element");
    scroller.style.overflowY = "auto";
    scroller.scrollTop = 400;
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const role = this.getAttribute("role");
        if (role === "tablist") return DOMRect.fromRect({ y: 48, height: 40 });
        if (role === "tabpanel") return DOMRect.fromRect({ y: -212 });
        return new DOMRect();
      });
    await act(async () => openSection("Advanced"));
    expect(scroller.scrollTop).toBe(100);
  });

  it("shows the selection's issues in danger", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [
            { id: "acc", type: "display", kind: "accordion", sections: [] },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Select Accordion Block"));
    expect(
      settings().getByRole("button", { name: "1 issue here" }).className,
    ).toContain("text-danger");
  });

  it("leaves focus on the canvas after a display-only builder deletes the selected block", async () => {
    renderDisplayOnlyBuilder(schema);
    selectElement("Beta");
    fromSelectionMenu("Delete block");
    await act(async () => {});
    await act(async () => selectElement("Gamma"));
    expect(
      screen
        .getByRole("complementary", { name: "Settings" })
        .contains(document.activeElement),
    ).toBe(false);
  });
});
