import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

describe("FormBuilder element JSON buttons", () => {
  serveApi(
    routes({
      "GET /tasks/listForms": () => Response.json([]),
      "GET /contract/admin": () =>
        Response.json([
          {
            id: 1,
            name: "Contract",
            createdAt: "2026-01-01T00:00:00.000Z",
            markdown: "Contract body",
            startDate: null,
            endDate: null,
            description: [],
          },
        ]),
      "GET /contract/current": () =>
        Response.json({ id: 1, markdown: "Contract body", description: [] }),
    }),
  );

  it("gives the selected page item one, and nested elements none", async () => {
    const builderSchema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            { type: "input", kind: "text", id: "a", label: "A" },
            {
              type: "display",
              kind: "accordion",
              id: "acc",
              sections: [
                {
                  id: "s",
                  title: "S",
                  blocks: [
                    { type: "display", kind: "header", id: "h", text: "H" },
                  ],
                },
              ],
            },
            {
              type: "input",
              kind: "list",
              id: "l",
              label: "L",
              fields: [{ type: "input", kind: "text", id: "sub", label: "S" }],
            },
            {
              type: "input",
              kind: "contract",
              id: "c",
              label: "C",
              contractId: 1,
              signQuestion: "Sign?",
              yesLabel: "Yes",
              noLabel: "No",
            },
          ],
        },
      ],
      outputViews: [],
    };
    renderFormBuilder(builderSchema);

    for (const label of ["A", "Accordion Block: S", "L", "C"]) {
      selectElement(label);
      openSection("Advanced");
      expect(
        screen.getAllByRole("button", { name: "Edit element JSON" }),
      ).toHaveLength(1);
    }
    await screen.findAllByText("Contract body");
  });
});

describe("FormBuilder JSON buttons open their own scope", () => {
  serveApi(routes({ "GET /tasks/listForms": () => Response.json([]) }));

  const openedJson = (name: string) =>
    JSON.parse(
      screen.getByRole<HTMLTextAreaElement>("textbox", { name }).value,
    );

  it("opens a later element and the selected page", () => {
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [
            { type: "input", kind: "text", id: "a", label: "A" },
            { type: "input", kind: "text", id: "b", label: "B" },
          ],
        },
        { id: "p2", title: "Two", fields: [] },
      ],
      outputViews: [],
    });

    selectElement("B");
    openSection("Advanced");
    fireEvent.click(screen.getByRole("button", { name: "Edit element JSON" }));
    expect(openedJson("Element JSON").id).toBe("b");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    openSection("Advanced");
    fireEvent.click(screen.getByRole("button", { name: "Edit page JSON" }));
    expect(openedJson("Page JSON").id).toBe("p2");
  });
});

describe("FormBuilder form JSON Apply", () => {
  serveApi(routes({ "GET /tasks/listForms": () => Response.json([]) }));

  it("edits the last page when the pasted form has fewer than the selected one", async () => {
    renderFormBuilder({
      pages: [
        { id: "p1", title: "One", fields: [] },
        { id: "p2", title: "Two", fields: [] },
      ],
      outputViews: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
      target: {
        value: JSON.stringify({
          pages: [{ id: "p1", title: "Only", fields: [] }],
          outputViews: [],
        }),
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });

    const title = screen.getByPlaceholderText<HTMLInputElement>("Page title");
    expect(title.value).toBe("Only");
    fireEvent.change(title, { target: { value: "Edited" } });
    expect(title.value).toBe("Edited");
  });
});

describe("FormBuilder element JSON Apply", () => {
  serveApi(routes({ "GET /tasks/listForms": () => Response.json([]) }));

  it("keeps the element selected through a change to its id", async () => {
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          fields: [{ type: "input", kind: "text", id: "city", label: "City" }],
        },
      ],
      outputViews: [],
    });
    selectElement("City");
    openSection("Advanced");
    fireEvent.click(screen.getByRole("button", { name: "Edit element JSON" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Element JSON" }), {
      target: {
        value: JSON.stringify({
          type: "input",
          kind: "text",
          id: "city2",
          label: "City",
        }),
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Apply id and kind changes" }),
      );
    });

    expect(settings().getAllByRole("heading")[0]?.textContent).toBe(
      "Text Field: City",
    );
  });
});
