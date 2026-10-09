import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  heading,
  outline,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { nestedSchema, subFieldOrder } from "../lib/testing/nestedForm";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

describe("nested elements on the canvas", () => {
  it("edits a list's sub-field from the canvas, in the list's schema", () => {
    renderFormBuilder(nestedSchema);
    selectElement("Text Field: Name");
    expect(heading()).toBe("Text Field: Name");
    expect(
      canvasButton("Select Text Field: Name").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      canvasButton("Select List Field: Kids").getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.change(settings().getByPlaceholderText("Enter field label"), {
      target: { value: "Child name" },
    });
    expect(subFieldOrder()).toEqual([
      "Select Text Field: Child name",
      "Select Number Field: Age",
    ]);
    expect(
      outline().getByRole("button", { name: "Text Field: Child name" }),
    ).toBeTruthy();
  });

  it("selects a sub-field from the outline", () => {
    renderFormBuilder(nestedSchema);
    expect(
      outline().queryByRole("button", { name: "Number Field: Age" }),
    ).toBeNull();
    fireEvent.click(
      outline().getByRole("button", { name: "Contents of List Field: Kids" }),
    );
    fireEvent.click(
      outline().getByRole("button", { name: "Number Field: Age" }),
    );
    expect(heading()).toBe("Number Field: Age");
    expect(
      canvasButton("Select Number Field: Age").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("edits an accordion block from the outline, opening its section", () => {
    renderFormBuilder(nestedSchema);
    expect(canvas().queryByText("Ships fast")).toBeNull();
    fireEvent.click(
      outline().getByRole("button", {
        name: "Contents of Accordion Block: Shipping, Returns",
      }),
    );
    fireEvent.click(
      outline().getByRole("button", { name: "Contents of Section: Shipping" }),
    );
    fireEvent.click(
      outline().getByRole("button", { name: "Text Block: Ships fast" }),
    );
    expect(heading()).toBe("Text Block: Ships fast");
    expect(
      canvasButton("Contents of Section: Shipping").getAttribute(
        "aria-expanded",
      ),
    ).toBe("true");

    fireEvent.change(settings().getByPlaceholderText("Enter text content"), {
      target: { value: "Ships today" },
    });
    expect(canvas().getByText("Ships today")).toBeTruthy();
  });

  it("selects a section's block on the canvas, revealing it in the outline", () => {
    renderFormBuilder(nestedSchema);
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: Ships fast"));
    expect(heading()).toBe("Text Block: Ships fast");
    expect(
      outline()
        .getByRole("button", { name: "Text Block: Ships fast" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("marks a collapsed entry current while it hides the selection", () => {
    const outlineCurrent = (name: string) =>
      outline().getByRole("button", { name }).getAttribute("aria-current");
    renderFormBuilder(nestedSchema);
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: Ships fast"));
    expect(outlineCurrent("Section: Shipping")).toBe("false");

    fireEvent.click(
      outline().getByRole("button", { name: "Contents of Section: Shipping" }),
    );
    expect(outlineCurrent("Section: Shipping")).toBe("true");
    expect(outlineCurrent("Accordion Block: Shipping, Returns")).toBe("false");

    fireEvent.click(
      outline().getByRole("button", {
        name: "Contents of Accordion Block: Shipping, Returns",
      }),
    );
    expect(outlineCurrent("Accordion Block: Shipping, Returns")).toBe("true");
  });

  it("renames a section from its settings", () => {
    renderFormBuilder(nestedSchema);
    fireEvent.click(canvasButton("Select Section: Returns"));
    expect(heading()).toBe("Section: Returns");
    fireEvent.change(
      settings().getByRole("textbox", { name: "Section title" }),
      {
        target: { value: "Refunds" },
      },
    );
    expect(heading()).toBe("Section: Refunds");
    expect(canvasButton("Select Section: Refunds")).toBeTruthy();
  });

  it("opens the section of a block selected from the accordion's rows", () => {
    renderFormBuilder(nestedSchema);
    selectElement("Accordion Block: Shipping, Returns");
    fireEvent.click(
      settings().getByRole("button", { name: "Text Block: Ships fast" }),
    );
    expect(
      canvasButton("Contents of Section: Shipping").getAttribute(
        "aria-expanded",
      ),
    ).toBe("true");
  });

  it("shows a list's example card as respondents see it", () => {
    // The card's remove button carries no name of its own.
    const removeCard = () =>
      canvas().getByRole<HTMLButtonElement>("button", { name: "" });
    renderFormBuilder(nestedSchema);
    expect(canvas().getByText("Add item")).toBeTruthy();
    expect(removeCard().disabled).toBe(false);
    expect(
      canvas().queryByText("This will not be shown to other members."),
    ).toBeNull();
    cleanup();

    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "kids",
              type: "input",
              kind: "list",
              label: "Kids",
              min: 1,
              max: 1,
              outputViewHiddenFieldIds: ["age"],
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
                { id: "age", type: "input", kind: "number", label: "Age" },
              ],
            },
          ],
        },
      ],
    });
    expect(canvas().queryByText("Add item")).toBeNull();
    expect(removeCard().disabled).toBe(true);
    expect(
      within(canvasButton("Select Number Field: Age").parentElement!).getByText(
        "This will not be shown to other members.",
      ),
    ).toBeTruthy();
  });

  it("names an untitled section on the canvas", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [{ id: "s1", title: "", blocks: [] }],
            },
          ],
        },
      ],
    });
    expect(canvasButton("Select Section: Untitled section").textContent).toBe(
      "Untitled section",
    );
  });

  it("keeps a section's video playable on the canvas, its text inert", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s1",
                  title: "Shipping",
                  blocks: [
                    { id: "v", type: "display", kind: "video", src: "v.m3u8" },
                    { id: "t", type: "display", kind: "text", text: "Fast" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    const inert = (name: RegExp) =>
      canvas()
        .getByRole("button", { name })
        .parentElement!.querySelector("[inert]") !== null;
    expect(inert(/^Select Video/)).toBe(false);
    expect(inert(/^Select Text Block/)).toBe(true);
  });

  it("keeps one section open when the accordion allows only one", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "faq",
              type: "display",
              kind: "accordion",
              singleOpen: true,
              sections: [
                { id: "s1", title: "Shipping", blocks: [] },
                { id: "s2", title: "Returns", blocks: [] },
              ],
            },
          ],
        },
      ],
    });
    const expanded = (title: string) =>
      canvasButton(`Contents of Section: ${title}`).getAttribute(
        "aria-expanded",
      );
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Contents of Section: Returns"));
    expect(expanded("Shipping")).toBe("false");
    expect(expanded("Returns")).toBe("true");
  });

  it("opens a sub-field's conditions from its indicator", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "kids",
              type: "input",
              kind: "list",
              label: "Kids",
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
                {
                  id: "age",
                  type: "input",
                  kind: "number",
                  label: "Age",
                  visibleIfFormula: {
                    conditions: {
                      c1: { kind: "hasValue", when: "name", hasValue: true },
                    },
                    formula: "c1",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(
      canvasButton("Edit conditions: shown when Name is answered"),
    );
    expect(heading()).toBe("Number Field: Age");
    expect(
      screen
        .getByRole("tab", { name: "Conditions" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("shows no indicator on a sub-field that has no conditions settings", () => {
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "kids",
              type: "input",
              kind: "list",
              label: "Kids",
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
                {
                  id: "share",
                  type: "input",
                  kind: "custom",
                  componentId: "share-url",
                  label: "Share",
                  visibleIfFormula: {
                    conditions: {
                      c1: { kind: "hasValue", when: "name", hasValue: true },
                    },
                    formula: "c1",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(
      screen.queryByRole("button", {
        name: "Edit conditions: shown when Name is answered",
      }),
    ).toBeNull();
  });
});
