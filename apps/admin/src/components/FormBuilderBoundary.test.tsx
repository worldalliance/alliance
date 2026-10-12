import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import {
  canvas,
  canvasButton,
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { nestedSchema } from "../lib/testing/nestedForm";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";
import * as nestedBlocks from "./display-blocks/EditableNestedBlock";
import * as canvasContent from "./form-canvas/CanvasContent";
import * as fieldEditors from "./form-fields/fieldEditors";

afterEach(cleanup);

const withLabelA = (...fields: PageItem[]): FormSchema => ({
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "a", type: "input", kind: "text", label: "Label a" },
        ...fields,
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
});

// renderFormBuilder mounts no ShareLinkViewerProvider, so a share-target link throws.
const unrenderableLink: PageItem = {
  id: "link",
  type: "display",
  kind: "biglink",
  text: "Join us",
  url: "https://example.org",
  externalTargetId: 3,
};

const openPanel = () => within(settings().getByRole("tabpanel"));

describe("FormBuilder render failures", () => {
  it("flags an element that can't render, keeping it editable and showing it once repaired", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    renderFormBuilder(withLabelA(unrenderableLink));

    expect(canvas().getByText("This element can't be shown")).toBeTruthy();
    expect(canvas().getByText("Label a")).toBeTruthy();

    selectElement("Join us");
    openSection("Advanced");
    fireEvent.click(
      settings().getByRole("button", { name: "Edit element JSON" }),
    );
    const { externalTargetId: _dropped, ...repaired } = unrenderableLink;
    fireEvent.change(screen.getByRole("textbox", { name: /JSON/ }), {
      target: { value: JSON.stringify(repaired) },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });

    expect(canvas().queryByText("This element can't be shown")).toBeNull();
    expect(canvas().getByText("Join us")).toBeTruthy();
  });

  it("offers no inline edit on a flagged element", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(canvasContent, "CanvasQuestion").mockImplementation(() => {
      throw new Error("question broke");
    });
    renderFormBuilder(withLabelA());
    selectElement("Label a");
    expect(canvas().getByText("question broke")).toBeTruthy();
    expect(canvas().queryByRole("button", { name: "Edit label" })).toBeNull();
  });

  it("shows why the preview can't render, keeping Edit", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    renderFormBuilder(withLabelA(unrenderableLink));

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("The preview can't be shown")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(canvas().getByText("Label a")).toBeTruthy();
  });

  it("shows why an update's preview can't render, keeping Edit", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    renderDisplayOnlyBuilder({
      pages: [
        {
          id: "p1",
          fields: [
            { id: "h", type: "display", kind: "header", text: "News" },
            unrenderableLink,
          ],
        },
      ],
      outputViews: [],
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("The preview can't be shown")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(canvas().getByText("News")).toBeTruthy();
  });

  it("flags a selected element whose settings can't render, keeping Advanced", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(fieldEditors, "renderFieldEditor").mockImplementation(() => {
      throw new Error("editor broke");
    });
    renderFormBuilder(withLabelA());
    selectElement("Label a");

    expect(settings().getByText("This element can't be shown")).toBeTruthy();
    expect(openPanel().getByText("editor broke")).toBeTruthy();
    openSection("Conditions");
    expect(openPanel().getByText("editor broke")).toBeTruthy();
    openSection("Advanced");
    expect(
      settings().getByRole("button", { name: "Edit element JSON" }),
    ).toBeTruthy();
  });

  it("flags a selected nested block whose settings can't render, keeping Delete", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const Broken = (): never => {
      throw new Error("block editor broke");
    };
    jest
      .spyOn(nestedBlocks, "EditableNestedBlock")
      .mockImplementation(() => <Broken />);
    renderFormBuilder(nestedSchema);
    fireEvent.click(canvasButton("Contents of Section: Shipping"));
    fireEvent.click(canvasButton("Select Text Block: Ships fast"));

    expect(openPanel().getByText("block editor broke")).toBeTruthy();
    openSection("Advanced");
    expect(openPanel().getByText("block editor broke")).toBeTruthy();
    expect(settings().getByRole("button", { name: /^Delete/ })).toBeTruthy();
  });
});
