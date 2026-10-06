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

const groupCards = () =>
  screen.queryAllByRole("region", { name: "Visibility group" });
const memberCounts = () =>
  groupCards().map(
    (card) => within(card).getByText(/^Shared visibility/).textContent,
  );
const saveButton = () =>
  screen.getByRole("button", { name: /No changes|Save Form/ });

describe("FormBuilder visibility groups", () => {
  it("wraps matching neighbors in one group with a shared summary", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c")]));
    const [card] = groupCards();
    expect(groupCards()).toHaveLength(1);
    expect(
      within(card).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
    expect(
      within(card).getByText("Shown when Label q is answered"),
    ).toBeTruthy();
    expect(
      within(card).getAllByRole("button", {
        name: "Edit visibility separately",
      }),
    ).toHaveLength(2);
  });

  it("splits and collapses without marking the form unsaved", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c", X)]));
    const [card] = groupCards();
    fireEvent.click(
      within(card).getByRole("button", { name: "Collapse group" }),
    );
    expect(within(card).queryByDisplayValue("Label a")).toBeNull();
    expect(
      within(card).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Expand group" }));

    fireEvent.click(
      within(card).getAllByRole("button", { name: "Split group here" })[1],
    );
    expect(groupCards()).toHaveLength(1);
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
    fireEvent.click(
      within(groupCards()[0]).getByRole("button", {
        name: "Edit as expression",
      }),
    );
    fireEvent.change(
      within(groupCards()[0]).getByRole("textbox", { name: "Expression" }),
      { target: { value: "NOT condition1" } },
    );
    const [card] = groupCards();
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
    expect(
      within(card).getByText("Shown when NOT Label q is answered"),
    ).toBeTruthy();
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("clearing shared visibility dissolves the group and dirties the form", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    fireEvent.click(screen.getByRole("button", { name: "Clear visibility" }));
    expect(groupCards()).toHaveLength(0);
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("joins a neighbor by adopting its condition", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c")]));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Share the previous element's visibility",
      }),
    );
    const [card] = groupCards();
    expect(
      within(card).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
    expect(saveButton().textContent).toBe("Save Form");
  });

  it("says when joining replaces the element's own condition", () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", shownWhen("a"))]),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use the previous element's visibility, replacing this element's",
      }),
    );
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
  });

  it("merges split halves that share a condition in one click", () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", X), text("d", X)]),
    );
    fireEvent.click(
      within(groupCards()[0]).getAllByRole("button", {
        name: "Split group here",
      })[1],
    );
    expect(groupCards()).toHaveLength(2);
    fireEvent.click(
      within(groupCards()[0]).getByRole("button", {
        name: "Merge with the next group",
      }),
    );
    expect(groupCards()).toHaveLength(1);
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 4 elements"),
    ).toBeTruthy();
    expect(saveButton().textContent).toBe("No changes");
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
    fireEvent.click(
      within(groupCards()[0]).getByRole("button", {
        name: "Merge with the next group",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Use previous group's visibility/ }),
    );
    const [card] = groupCards();
    expect(groupCards()).toHaveLength(1);
    expect(
      within(card).getByText("Shared visibility · 4 elements"),
    ).toBeTruthy();
    expect(
      within(card).getByText("Shown when Label q is answered"),
    ).toBeTruthy();
  });

  it("gives an element added inside a group the group's condition", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    const [card] = groupCards();
    const addButtons = within(card).getAllByTitle("Add element here");
    fireEvent.click(addButtons[addButtons.length - 1]);
    fireEvent.change(screen.getByPlaceholderText(/Type to search/), {
      target: { value: "Email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^Email Field\s*Field$/ }),
    );
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
  });

  it("offers copying an existing element only outside a group", () => {
    const searchCopyAt = (addButton: (cards: HTMLElement[]) => HTMLElement) => {
      cleanup();
      renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
      fireEvent.click(addButton(groupCards()));
      fireEvent.change(screen.getByPlaceholderText(/Type to search/), {
        target: { value: "Copy Existing" },
      });
      return screen.queryByRole("button", {
        name: /^Copy Existing Element\s*Copy$/,
      });
    };
    expect(
      searchCopyAt(
        ([card]) => within(card).getAllByTitle("Add element here")[0],
      ),
    ).toBeNull();
    expect(
      searchCopyAt(() => screen.getAllByTitle("Add element here")[0]),
    ).not.toBeNull();
  });

  it("groups a copied page like a freshly loaded one", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X)]));
    fireEvent.click(screen.getByRole("button", { name: "Copy Page 1" }));
    expect(memberCounts()).toEqual(["Shared visibility · 2 elements"]);
  });

  it("leaves no empty options menu on a grouped accordion", () => {
    renderFormBuilder(
      schemaWith([
        text("a", X),
        {
          id: "acc",
          type: "display",
          kind: "accordion",
          sections: [],
          visibleIfFormula: X,
        },
      ]),
    );
    expect(
      within(groupCards()[0]).queryByRole("button", {
        name: "Display block options",
      }),
    ).toBeNull();
  });

  it("ungrouping or detaching keeps the form saved", () => {
    renderFormBuilder(schemaWith([text("a", X), text("b", X), text("c", X)]));
    fireEvent.click(
      within(groupCards()[0]).getAllByRole("button", {
        name: "Edit visibility separately",
      })[0],
    );
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ungroup all" }));
    expect(groupCards()).toHaveLength(0);
    expect(saveButton().textContent).toBe("No changes");
  });

  it("shows a self-dependency error inside the group", () => {
    renderFormBuilder(
      schemaWith([text("a", shownWhen("a")), text("b", shownWhen("a"))]),
    );
    const [card] = groupCards();
    expect(within(card).getByRole("alert").textContent).toBe(
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
    const items = within(within(groupCards()[0]).getByRole("alert"))
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
    fireEvent.click(
      within(groupCards()[0]).getAllByRole("button", {
        name: "Split group here",
      })[0],
    );
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
    await applyFormJson(grouped);
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 3 elements"),
    ).toBeTruthy();
  });

  const splitHalves = () => {
    renderFormBuilder(
      schemaWith([text("a", X), text("b", X), text("c", X), text("d", X)]),
    );
    fireEvent.click(
      within(groupCards()[0]).getAllByRole("button", {
        name: "Split group here",
      })[1],
    );
  };
  const applyElementJson = async (element: PageItem) => {
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit element JSON" })[1],
    );
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
    fireEvent.click(
      within(groupCards()[0]).getAllByRole("button", {
        name: "Split group here",
      })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Form" }));
    await waitFor(() => expect(saveButton().textContent).toBe("No changes"));
    await act(async () => {});
    expect(groupCards()).toHaveLength(1);
    expect(
      within(groupCards()[0]).getByText("Shared visibility · 2 elements"),
    ).toBeTruthy();
  });
});
