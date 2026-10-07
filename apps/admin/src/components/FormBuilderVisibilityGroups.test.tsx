import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import {
  canvasGroups,
  insertElement,
  openSection,
  selectElement,
  selectGroup,
  settings,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import { FormBuilder } from "./FormBuilder";

afterEach(cleanup);

const shownWhen = (when: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "hasValue", when, hasValue: true } },
  formula: "c1",
});
const X = shownWhen("q");

const text = (id: string, visibleIfFormula?: VisibleIfFormula): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: `Label ${id}`,
  ...(visibleIfFormula ? { visibleIfFormula } : {}),
});

const schemaWith = (fields: PageItem[]): FormSchema => ({
  pages: [{ id: "p1", title: "Page 1", fields: [text("q"), ...fields] }],
  outputViews: [],
  aggregateViews: [],
});

const memberCounts = () =>
  canvasGroups().map(
    (group) => within(group).getByText(/^Shared visibility/).textContent,
  );
const saveButton = () =>
  screen.getByRole("button", { name: /No changes|Save Form/ });
const openGroup = (
  index: number,
  section: "Content" | "Conditions" = "Conditions",
) => {
  selectGroup(canvasGroups()[index]!);
  openSection(section);
};
const splitButtons = () =>
  settings().getAllByRole("button", { name: /^Split group before / });
const detachButtons = () =>
  settings().getAllByRole("button", {
    name: /^Edit .* visibility separately$/,
  });

describe("FormBuilder visibility groups", () => {
  it("wraps matching neighbors in one group with a shared summary", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c")]));
    const [group] = canvasGroups();
    expect(canvasGroups()).toHaveLength(1);
    expect(
      within(group!).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
    expect(
      within(group!).getByText("Shown when Label q is answered"),
    ).toBeTruthy();
    openGroup(0, "Content");
    expect(detachButtons()).toHaveLength(2);
  });

  it("opens a group's shared rule, and its members from there", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    selectGroup(canvasGroups()[0]!);
    expect(
      screen
        .getByRole("tab", { name: "Conditions" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    openSection("Content");
    fireEvent.click(
      settings().getByRole("button", { name: "Text Field: Label b" }),
    );
    expect(settings().getByDisplayValue("Label b")).toBeTruthy();
  });

  it("splits without marking the form unsaved", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c", X)]));
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[1]!);
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
    expect(saveButton().textContent).toBe("No changes");
  });

  it("writes an edit in the shared editor to every member", () => {
    const named: VisibleIfFormula = {
      conditions: {
        condition1: { kind: "hasValue", when: "q", hasValue: true },
      },
      formula: "condition1",
    };
    renderFormBuilder(schemaWith([text("a", named), text("b", named)]));
    openGroup(0);
    fireEvent.click(
      settings().getByRole("button", { name: "Edit as expression" }),
    );
    fireEvent.change(settings().getByRole("textbox", { name: "Expression" }), {
      target: { value: "NOT condition1" },
    });
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
    expect(
      within(canvasGroups()[0]!).getByText(
        "Shown when NOT Label q is answered",
      ),
    ).toBeTruthy();
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("clearing shared visibility dissolves the group and dirties the form", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    openGroup(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear visibility" }));
    expect(canvasGroups()).toHaveLength(0);
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("joins a neighbor by adopting its condition", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c")]));
    selectElement("Label c");
    openSection("Conditions");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Share the previous element's visibility",
      }),
    );
    expect(memberCounts()).toEqual(["Shared visibility · 3 elements"]);
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("says when joining replaces the element's own condition", () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", shownWhen("a"))]),
    );
    selectElement("Label c");
    openSection("Conditions");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use the previous element's visibility, replacing this element's",
      }),
    );
    expect(memberCounts()).toEqual(["Shared visibility · 3 elements"]);
  });

  it("merges split halves that share a condition in one click", () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", X), text("d", X)]),
    );
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[1]!);
    expect(canvasGroups()).toHaveLength(2);
    openSection("Conditions");
    fireEvent.click(
      settings().getByRole("button", { name: "Merge with the next group" }),
    );
    expect(memberCounts()).toEqual(["Shared visibility · 4 elements"]);
    expect(saveButton().textContent).toBe("No changes");
  });

  it("keeps the merged group selected after merging into the previous one", () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", X), text("d", X)]),
    );
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[1]!);
    openGroup(1);
    fireEvent.click(
      settings().getByRole("button", { name: "Merge with the previous group" }),
    );
    expect(memberCounts()).toEqual(["Shared visibility · 4 elements"]);
    expect(settings().getAllByRole("heading")[0]?.textContent).toBe(
      "Shared visibility",
    );
  });

  it("merges groups with different conditions under the chosen one", () => {
    renderFormBuilder(
      schemaWith([
        text("a", X),
        text("b", X),
        text("c", shownWhen("a")),
        text("d", shownWhen("a")),
      ]),
    );
    openGroup(0);
    fireEvent.click(
      settings().getByRole("button", { name: "Merge with the next group" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Use previous group's visibility/ }),
    );
    expect(memberCounts()).toEqual(["Shared visibility · 4 elements"]);
    expect(
      within(canvasGroups()[0]!).getByText("Shown when Label q is answered"),
    ).toBeTruthy();
  });

  it("gives an element added inside a group the group's condition", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    const addButtons = within(canvasGroups()[0]!).getAllByTitle(
      "Add element here",
    );
    insertElement(addButtons[addButtons.length - 1]!, "Email Field");
    expect(memberCounts()).toEqual(["Shared visibility · 3 elements"]);
  });

  it("offers copying an existing element only outside a group", () => {
    const searchCopyAt = (
      addButton: (groups: HTMLElement[]) => HTMLElement,
    ) => {
      cleanup();
      renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
      fireEvent.click(addButton(canvasGroups()));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search elements" }),
        { target: { value: "Copy Existing" } },
      );
      return screen.queryByRole("button", {
        name: /^Copy Existing Element\s*Copy$/,
      });
    };
    expect(
      searchCopyAt(
        ([group]) => within(group!).getAllByTitle("Add element here")[0]!,
      ),
    ).toBeNull();
    expect(
      searchCopyAt(() => screen.getAllByTitle("Add element here")[0]!),
    ).not.toBeNull();
  });

  it("groups a copied page like a freshly loaded one", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    fireEvent.click(screen.getByRole("button", { name: "Copy Page 1" }));
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
  });

  it("points a grouped member's conditions at its group", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    selectElement("Label a");
    openSection("Conditions");
    expect(
      settings().getByText("Visibility is shared with its group."),
    ).toBeTruthy();
    expect(settings().queryByRole("button", { name: "Add rule" })).toBeNull();
  });

  it("ungrouping or detaching keeps the form saved", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c", X)]));
    openGroup(0, "Content");
    fireEvent.click(detachButtons()[0]!);
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
    openSection("Conditions");
    fireEvent.click(screen.getByRole("button", { name: "Ungroup all" }));
    expect(canvasGroups()).toHaveLength(0);
    expect(saveButton().textContent).toBe("No changes");
  });

  it("flags a group's errors on the canvas, and lists them in its settings", () => {
    renderFormBuilder(
      schemaWith([text("a", shownWhen("a")), text("b", shownWhen("a"))]),
    );
    expect(
      within(canvasGroups()[0]!).getByText("1 member with errors"),
    ).toBeTruthy();
    openGroup(0);
    expect(settings().getByRole("alert").textContent).toBe(
      'Label a: Visibility of "a" depends on its own answer',
    );
  });

  it("names the member behind each error in the group", () => {
    const badDate: VisibleIfFormula = {
      conditions: {
        c1: { kind: "firstContractSigned", comparison: "before", date: "x" },
      },
      formula: "c1",
    };
    renderFormBuilder(schemaWith([text("a", badDate), text("b", badDate)]));
    openGroup(0);
    const items = within(settings().getByRole("alert"))
      .getAllByRole("listitem")
      .map((item) => item.textContent?.split(":")[0]);
    expect(items).toEqual(["Label a", "Label b"]);
  });
});

function StatefulFormBuilder({ initialFormId }: { initialFormId?: number }) {
  const [formId, setFormId] = useState(initialFormId);
  return <FormBuilder formId={formId} setFormId={setFormId} />;
}

const renderStatefulFormBuilder = (initialFormId?: number) =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RouterProvider
            router={createMemoryRouter([
              {
                path: "/",
                element: <StatefulFormBuilder initialFormId={initialFormId} />,
              },
            ])}
          />
        </ToastProvider>
      </QueryClientProvider>
    </SiteOriginLinkProvider>,
  );

const applyFormJson = async (schema: FormSchema) => {
  fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
    target: { value: JSON.stringify(schema) },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  });
};

describe("FormBuilder visibility groups across loads", () => {
  const grouped = schemaWith([text("a", X), text("b", X), text("c", X)]);
  serveApi(
    routes(
      {
        "POST /tasks/createForm": () =>
          Response.json({ id: 5, schema: grouped, formSnapshotId: 1 }),
        "GET /tasks/slug/:id": () =>
          Response.json({ id: 5, schema: grouped, formSnapshotId: 1 }),
      },
      () => Response.json([]),
    ),
  );

  it("regroups when the whole form's JSON is replaced", async () => {
    renderFormBuilder(grouped);
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[0]!);
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
    await applyFormJson(grouped);
    expect(memberCounts()).toEqual(["Shared visibility · 3 elements"]);
  });

  const splitHalves = () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", X), text("d", X)]),
    );
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[1]!);
  };
  const applyElementJson = async (element: PageItem) => {
    selectElement("Label a");
    openSection("Advanced");
    fireEvent.click(screen.getByRole("button", { name: "Edit element JSON" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Element JSON" }), {
      target: { value: JSON.stringify(element) },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
  };

  it("detaches only the member whose element JSON changes its visibility", async () => {
    splitHalves();
    await applyElementJson(text("a", shownWhen("b")));
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
  });

  it("keeps groups through an unrelated element JSON edit", async () => {
    splitHalves();
    await applyElementJson({
      id: "a",
      type: "input",
      kind: "text",
      label: "Renamed",
      visibleIfFormula: X,
    });
    expect(memberCounts()).toEqual([
      "Shared visibility · 2 elements",
      "Shared visibility · 2 elements",
    ]);
  });

  it("keeps a group's unsaved expression when its first member detaches", async () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c", X)]));
    openGroup(0);
    fireEvent.click(
      settings().getByRole("button", { name: "Edit as expression" }),
    );
    fireEvent.change(settings().getByRole("textbox", { name: "Expression" }), {
      target: { value: "c1 AND" },
    });
    await act(async () => {});

    openSection("Content");
    fireEvent.click(detachButtons()[0]!);
    openSection("Conditions");
    expect(
      settings().getByRole<HTMLTextAreaElement>("textbox", {
        name: "Expression",
      }).value,
    ).toBe("c1 AND");
  });

  it("groups a saved form when it opens", async () => {
    renderStatefulFormBuilder(5);
    await waitFor(() =>
      expect(memberCounts()).toEqual(["Shared visibility · 3 elements"]),
    );
  });

  it("keeps manual boundaries through a new form's first save", async () => {
    renderStatefulFormBuilder();
    await applyFormJson(grouped);
    fireEvent.click(
      screen.getByRole("button", { name: "Apply id and kind changes" }),
    );
    openGroup(0, "Content");
    fireEvent.click(splitButtons()[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Save Form" }));
    await waitFor(() => expect(saveButton().textContent).toBe("No changes"));
    await act(async () => {});
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
  });
});
