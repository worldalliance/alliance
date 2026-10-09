import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { nestedSchema } from "../lib/testing/nestedForm";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "Intro",
      fields: [
        {
          id: "town",
          type: "input",
          kind: "text",
          label: "**Where** in #{town_name}?",
        },
        { id: "h", type: "display", kind: "header", text: "Welcome" },
        {
          id: "pledge",
          type: "input",
          kind: "contract",
          contractId: null,
          label: "Pledge",
          signQuestion: "Do you sign?",
          yesLabel: "Yes",
          noLabel: "No",
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
  variables: [
    {
      name: "town_name",
      inputs: { input1: { kind: "field", fieldId: "town" } },
      formula: "input1",
    },
  ],
};

const canvasText = (name: string) =>
  canvas().getByRole<HTMLInputElement>("textbox", { name });
const queryCanvasText = (name: string) =>
  canvas().queryByRole("textbox", { name });
const type = async (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  await act(async () => {});
};

describe("inline text on the canvas", () => {
  it("shows a label's formatting and its variable tokens as authored", () => {
    renderFormBuilder(schema);
    const label = canvas().getByText("Where", { selector: "strong" });
    expect(label.parentElement?.textContent).toBe("Where in #{town_name}?");
  });

  it("edits a label containing a variable token in place, as one undo step", async () => {
    renderFormBuilder(schema);
    selectElement("**Where** in #{town_name}?");
    fireEvent.click(canvasButton("Edit label"));

    const input = canvasText("Label");
    expect(input.value).toBe("**Where** in #{town_name}?");
    expect(document.activeElement).toBe(input);

    await type(input, "**Where** in #{town_name} now?");
    await type(input, "**Where** in #{town_name} now, #{");
    expect(canvas().getByRole("option", { name: /town_name/ })).toBeTruthy();
    expect(
      settings().getByPlaceholderText<HTMLTextAreaElement>("Enter field label")
        .value,
    ).toBe("**Where** in #{town_name} now, #{");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(canvas().queryByRole("option")).toBeNull();
    expect(queryCanvasText("Label")).not.toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(queryCanvasText("Label")).toBeNull();
    const select = canvasButton(
      "Select Text Field: **Where** in #{town_name} now, #{",
    );
    expect(document.activeElement).toBe(select);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      canvas().getByText("Where", { selector: "strong" }).parentElement
        ?.textContent,
    ).toBe("Where in #{town_name}?");
  });

  it("opens a selected block's text on Enter, and closes it on Enter", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    fireEvent.keyDown(canvasButton("Select Header Block: Welcome"), {
      key: "Enter",
    });
    const input = canvasText("Text");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(queryCanvasText("Text")).toBeNull();
    expect(canvas().getByRole("heading", { name: "Hello" })).toBeTruthy();
  });

  it("leaves Enter on the variable picker to the picker", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    fireEvent.click(canvasButton("Edit text"));
    const picker = canvasButton("Insert a variable");
    expect(fireEvent.keyDown(picker, { key: "Enter" })).toBe(true);
    expect(queryCanvasText("Text")).not.toBeNull();
  });

  it("keeps a single line open on Enter that confirms an IME composition", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    fireEvent.click(canvasButton("Edit text"));
    fireEvent.keyDown(canvasText("Text"), { key: "Enter", isComposing: true });
    expect(queryCanvasText("Text")).not.toBeNull();
  });

  it("closes when focus leaves the text", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    fireEvent.click(canvasButton("Edit text"));
    fireEvent.blur(canvasText("Text"), { relatedTarget: document.body });
    expect(queryCanvasText("Text")).toBeNull();
  });

  it("offers editing only on the selection, and not on a contract's hidden label", () => {
    renderFormBuilder(schema);
    expect(canvas().queryByRole("button", { name: "Edit text" })).toBeNull();
    fireEvent.keyDown(canvasButton("Select Header Block: Welcome"), {
      key: "Enter",
    });
    expect(queryCanvasText("Text")).toBeNull();

    selectElement("Pledge");
    expect(canvas().queryByRole("button", { name: "Edit label" })).toBeNull();
    fireEvent.keyDown(canvasButton("Select Contract Field: Pledge"), {
      key: "Enter",
    });
    expect(queryCanvasText("Label")).toBeNull();
  });

  it("closes when the selection moves elsewhere", () => {
    renderFormBuilder(schema);
    selectElement("Welcome");
    fireEvent.click(canvasButton("Edit text"));
    selectElement("Pledge");
    selectElement("Welcome");
    expect(queryCanvasText("Text")).toBeNull();
  });

  it("hides a checkbox's rendered label while its label is open", () => {
    renderFormBuilder({
      ...schema,
      pages: [
        {
          id: "p1",
          fields: [
            { id: "ok", type: "input", kind: "checkbox", label: "Agree" },
          ],
        },
      ],
    });
    selectElement("Agree");
    fireEvent.click(canvasButton("Edit label"));
    expect(canvasText("Label").value).toBe("Agree");
    expect(canvas().queryByText("Agree", { ignore: "textarea" })).toBeNull();
  });

  it("renames the page from its title, which takes no variables", () => {
    renderFormBuilder(schema);
    fireEvent.click(canvasButton("Edit page title"));
    expect(
      canvas().queryByRole("button", { name: "Insert a variable" }),
    ).toBeNull();
    fireEvent.change(canvasText("Page title"), { target: { value: "Start" } });
    expect(
      settings().getByPlaceholderText<HTMLInputElement>("Page title").value,
    ).toBe("Start");
  });

  it("edits a list's own label", () => {
    renderFormBuilder(nestedSchema);
    selectElement("List Field: Kids");
    fireEvent.click(canvasButton("Edit label"));
    fireEvent.change(canvasText("Label"), { target: { value: "Children" } });
    fireEvent.keyDown(canvasText("Label"), { key: "Escape" });
    expect(canvasButton("Select List Field: Children")).toBeTruthy();
    expect(canvasButton("Select Text Field: Name")).toBeTruthy();
  });

  it("edits a list sub-field's label in the list", () => {
    renderFormBuilder(nestedSchema);
    selectElement("Text Field: Name");
    fireEvent.click(canvasButton("Edit label"));
    fireEvent.change(canvasText("Label"), { target: { value: "Child" } });
    fireEvent.keyDown(canvasText("Label"), { key: "Escape" });
    expect(canvasButton("Select Text Field: Child")).toBeTruthy();
    expect(canvasButton("Select Number Field: Age")).toBeTruthy();
  });

  it("edits an accordion's section title and a block inside it", () => {
    const [list, accordion] = nestedSchema.pages[0]!.fields;
    if (accordion?.kind !== "accordion") throw new Error("no accordion");
    const [shipping, returns] = accordion.sections;
    renderFormBuilder({
      ...nestedSchema,
      pages: [
        {
          ...nestedSchema.pages[0]!,
          fields: [
            list!,
            {
              ...accordion,
              sections: [
                {
                  ...shipping!,
                  blocks: [
                    { id: "t0", type: "display", kind: "text", text: "Free" },
                    ...shipping!.blocks,
                  ],
                },
                returns!,
              ],
            },
          ],
        },
      ],
    });
    fireEvent.click(canvasButton("Select Section: Shipping"));
    fireEvent.click(canvasButton("Edit section title"));
    fireEvent.change(canvasText("Section title"), {
      target: { value: "Delivery" },
    });
    fireEvent.keyDown(canvasText("Section title"), { key: "Enter" });
    expect(document.activeElement).toBe(
      canvasButton("Select Section: Delivery"),
    );

    fireEvent.click(canvasButton("Select Text Block: Ships fast"));
    fireEvent.click(canvasButton("Edit text"));
    fireEvent.change(canvasText("Text"), { target: { value: "Ships today" } });
    fireEvent.keyDown(canvasText("Text"), { key: "Escape" });
    expect(canvasButton("Select Text Block: Ships today")).toBeTruthy();
    expect(canvasButton("Select Text Block: Free")).toBeTruthy();
    expect(canvasButton("Select Section: Delivery")).toBeTruthy();
  });
});
