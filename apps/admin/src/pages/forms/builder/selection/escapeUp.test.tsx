import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import {
  heading,
  selectElement,
  settings,
} from "../../../../lib/testing/formCanvas";
import { nestedSchema } from "../../../../lib/testing/nestedForm";
import { renderFormBuilder } from "../../../../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const escape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });

describe("Escape in the builder", () => {
  it("moves the selection up a level at a time: child, element, page, form", () => {
    renderFormBuilder(nestedSchema);
    selectElement("List Field: Kids");
    fireEvent.click(
      settings().getByRole("button", { name: "Text Field: Name" }),
    );
    expect(heading()).toBe("Text Field: Name");

    escape();
    expect(heading()).toBe("List Field: Kids");
    escape();
    expect(heading()).toBe("Page settings");
    escape();
    expect(heading()).toBe("Form");
    escape();
    expect(heading()).toBe("Form");
  });

  it("leaves the selection alone while a text field has focus", () => {
    renderFormBuilder(nestedSchema);
    selectElement("List Field: Kids");
    const label = settings().getAllByRole("textbox")[0]!;
    label.focus();
    escape();
    expect(heading()).toBe("List Field: Kids");
  });
});
