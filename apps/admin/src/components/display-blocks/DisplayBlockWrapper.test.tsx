import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  formJson,
  openSection,
  selectElement,
} from "../../lib/testing/formCanvas";
import { renderFormBuilder } from "../../lib/testing/renderFormBuilder";

afterEach(cleanup);

serveApi(
  routes(
    {
      "GET /user/list": () => Response.json([makeUser({ id: 8, name: "Ben" })]),
    },
    () => Response.json([]),
  ),
);

const hasCity: VisibleIfFormula = {
  conditions: { c1: { kind: "userHasCity", userHasCity: true } },
  formula: "c1",
};

describe("a display block's own visibility", () => {
  it("clears the condition from every user's content too", () => {
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          fields: [
            {
              type: "display",
              kind: "copytext",
              id: "block-1",
              text: "",
              visibleIfFormula: hasCity,
              manualPerUser: true,
              manualUserContent: {
                "7": { text: "Dear Ana", visibleIfFormula: hasCity },
              },
            },
          ],
        },
      ],
      outputViews: [],
    });
    selectElement("Copy Text Block");
    openSection("Conditions");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove all conditions" }),
    );
    const json = formJson();
    expect(json).not.toContain("visibleIfFormula");
    expect(json).toContain("Dear Ana");
  });
});

describe("importing per-user content from the clipboard", () => {
  let paste: (text: string) => void = () => {};
  const startImport = (
    manualUserContent?: Record<string, { text: string }>,
  ) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () =>
          new Promise<string>((resolve) => {
            paste = resolve;
          }),
      },
    });
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          fields: [
            {
              type: "display",
              kind: "header",
              id: "h",
              text: "Welcome",
              manualPerUser: true,
              manualUserContent,
            },
            { id: "town", type: "input", kind: "text", label: "Town" },
          ],
        },
      ],
      outputViews: [],
    });
    selectElement("Welcome");
    fireEvent.click(
      screen.getByRole("button", { name: "Import from clipboard…" }),
    );
  };

  it("keeps an edit made while the clipboard is read", async () => {
    startImport();
    fireEvent.click(canvasButton("Edit text"));
    fireEvent.change(canvas().getByRole("textbox", { name: "Text" }), {
      target: { value: "Hello" },
    });
    await act(async () => paste('{"7": "Dear Ana"}'));

    const json = formJson();
    expect(json).toMatch(/"text": "Hello"/);
    expect(json).toContain("Dear Ana");
  });

  it("says so when the block is deleted while the clipboard is read", async () => {
    startImport();
    openSection("Advanced");
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));
    await act(async () => paste('{"7": "Dear Ana"}'));

    expect(
      screen.getByText(
        "The block was deleted before its content was imported.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/^Imported content/)).toBeNull();
    expect(formJson()).not.toContain("Dear Ana");
  });

  it("asks before replacing text typed while the clipboard is read", async () => {
    startImport({ "8": { text: "" } });
    fireEvent.click(await screen.findByRole("button", { name: "Ben" }));
    fireEvent.change(screen.getByPlaceholderText("Enter header text"), {
      target: { value: "Hey Ben" },
    });
    await act(async () => paste('{"8": "Hi Ben"}'));

    expect(
      screen.getByText("Overwrite existing per-user content?"),
    ).toBeTruthy();
  });
});
