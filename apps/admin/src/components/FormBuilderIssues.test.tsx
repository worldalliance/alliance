import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  canvas,
  heading,
  openSection,
  outline,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import {
  renderFormBuilder,
  renderSavedFormBuilder,
} from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const reads = (when: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "hasValue", when, hasValue: true } },
  formula: "c1",
});

const text = (id: string, visibleIfFormula?: VisibleIfFormula): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: `Label ${id}`,
  ...(visibleIfFormula && { visibleIfFormula }),
});

const twoPages = (second: PageItem[]): FormSchema => ({
  pages: [
    { id: "p1", title: "One", fields: [text("a")] },
    { id: "p2", title: "Two", fields: second },
  ],
  outputViews: [],
  aggregateViews: [],
});

const readsMissing = twoPages([text("b", reads("gone"))]);

const readsForm9: FormSchema = {
  ...twoPages([]),
  variables: [
    {
      name: "scores",
      inputs: {
        input1: { kind: "sourceField", sourceFormId: 9, fieldId: "score" },
      },
      formula: "input1.length",
    },
  ],
};

const writes: string[] = [];
const failing = new Set<string>();
const readsA = {
  inputs: { input1: { kind: "field", fieldId: "a" } },
  formula: "input1",
} as const;
const withVariable = (name: string): FormSchema => ({
  ...twoPages([]),
  variables: [{ name, ...readsA }],
});
const savedForms: Record<string, FormSchema> = {
  5: twoPages([text("b")]),
  7: withVariable("stored"),
};

const api = serveApi(
  routes(
    {
      "GET /tasks/slug/:id": ({ params }) =>
        failing.has(params.id!)
          ? new Response(null, { status: 500 })
          : Response.json({
              id: Number(params.id),
              schema: savedForms[params.id!] ?? {
                pages: [
                  {
                    id: "s1",
                    fields: [
                      {
                        id: "score",
                        type: "input",
                        kind: "number",
                        label: "S",
                      },
                    ],
                  },
                ],
              },
              formSnapshotId: 3,
            }),
      "PUT /tasks/updateForm/:formId": ({ params }) => {
        writes.push(params.formId!);
        return Response.json({ id: 1, formSnapshotId: 4 });
      },
    },
    () => Response.json([]),
  ),
);

beforeEach(() => {
  writes.length = 0;
  failing.clear();
});

const issueButton = () =>
  screen.queryByRole("button", { name: /^\d+ issues?$/ });
const issueList = () => within(screen.getByRole("region", { name: "Issues" }));
const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save Form" }));
  });
const edit = () =>
  fireEvent.change(screen.getByPlaceholderText("Page title"), {
    target: { value: "First" },
  });

describe("FormBuilder issues", () => {
  it("blocks Save, naming the count, until the rule is repaired", async () => {
    renderFormBuilder(readsMissing, 1);
    edit();
    await save();

    expect(issueList().getByText("Fix 1 issue before saving")).toBeTruthy();
    expect(writes).toEqual([]);

    fireEvent.click(outline().getByRole("button", { name: "Two" }));
    selectElement("Label b");
    openSection("Conditions");
    fireEvent.click(
      settings().getByRole("button", { name: "Remove all conditions" }),
    );
    expect(issueButton()).toBeNull();
    await save();
    await waitFor(() => expect(writes).toEqual(["1"]));
  });

  it("counts expression text that doesn't parse, though the formula before it does", async () => {
    renderFormBuilder(twoPages([text("b", reads("a"))]), 1);
    fireEvent.click(outline().getByRole("button", { name: "Two" }));
    edit();
    selectElement("Label b");
    openSection("Conditions");
    fireEvent.click(
      settings().getByRole("button", { name: "Edit as expression" }),
    );
    fireEvent.change(settings().getByRole("textbox", { name: "Expression" }), {
      target: { value: "c1 AND" },
    });
    await save();

    expect(issueList().getByText("Fix 1 issue before saving")).toBeTruthy();
    expect(
      issueList().getByText(/^Visibility expression isn't saved: /),
    ).toBeTruthy();
    expect(writes).toEqual([]);
  });

  it("lets a rule the expression uses go, flagging the expression until repaired", () => {
    renderFormBuilder(
      twoPages([
        text("b", {
          conditions: {
            c1: reads("a").conditions.c1!,
            c2: { kind: "hasValue", when: "a", hasValue: false },
          },
          formula: {
            op: "AND",
            left: "c1",
            right: { op: "OR", left: "c1", right: "c2" },
          },
        }),
      ]),
    );
    fireEvent.click(outline().getByRole("button", { name: "Two" }));
    selectElement("Label b");
    openSection("Conditions");
    fireEvent.click(
      within(settings().getByRole("listitem", { name: "Rule c2" })).getByRole(
        "button",
        { name: "Remove rule" },
      ),
    );

    expect(
      screen.getByRole("list", { name: "Issues here" }).textContent,
    ).toContain("uses c2, which no rule defines");
    fireEvent.change(settings().getByRole("textbox", { name: "Expression" }), {
      target: { value: "c1" },
    });
    expect(issueButton()).toBeNull();
  });

  it("blocks Preview while errors remain", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(issueList().getByText("Fix 1 issue before previewing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Form canvas" })).toBeTruthy();
  });

  it("restores the error and its gate when undo restores the rule", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(outline().getByRole("button", { name: "Two" }));
    selectElement("Label b");
    openSection("Conditions");
    fireEvent.click(
      settings().getByRole("button", { name: "Remove all conditions" }),
    );
    expect(issueButton()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(issueButton()?.textContent).toBe("1 issue");
  });

  it("marks the entry, and goes from the list to where the issue is repaired", () => {
    renderFormBuilder(readsMissing);
    expect(
      within(
        outline().getByRole("button", { name: "Two" }).parentElement!,
      ).getByRole("img", { name: "1 issue" }),
    ).toBeTruthy();

    fireEvent.click(issueButton()!);
    fireEvent.click(
      issueList().getByRole("button", { name: /^Two › Text Field: Label b/ }),
    );

    expect(screen.queryByRole("region", { name: "Issues" })).toBeNull();
    expect(heading()).toBe("Text Field: Label b");
    expect(settings().getByRole("tab", { selected: true }).textContent).toBe(
      "Conditions",
    );
    expect(
      screen.getByRole("list", { name: "Issues here" }).textContent,
    ).toContain('reads question "gone"');
    expect(canvas().getByRole("img", { name: "1 issue" })).toBeTruthy();
  });

  it("opens the output view an issue is in", () => {
    renderFormBuilder({
      ...twoPages([]),
      outputViews: [
        { type: "default", id: "v1", title: "Summary", blocks: [] },
        {
          type: "default",
          id: "v2",
          title: "Detail",
          blocks: [
            {
              id: "out",
              type: "display",
              kind: "text",
              text: "Hi",
              visibleIfFormula: { conditions: {}, formula: "c1" },
            },
          ],
        },
      ],
    });
    fireEvent.click(issueButton()!);
    fireEvent.click(
      issueList().getByRole("button", { name: /^Output view: Detail/ }),
    );

    expect(
      screen.getByPlaceholderText<HTMLInputElement>("Output view title").value,
    ).toBe("Detail");
  });

  it("opens a group's shared rule, or Variables, from the list", () => {
    const shared: VisibleIfFormula = { conditions: {}, formula: "c1" };
    renderFormBuilder({
      ...twoPages([]),
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [text("a", shared), text("b", shared)],
        },
      ],
      variables: [{ name: "bad name", inputs: {}, formula: "1" }],
    });
    fireEvent.click(issueButton()!);
    fireEvent.click(
      issueList().getByRole("button", { name: /^One › Shared visibility/ }),
    );
    expect(heading()).toBe("Shared visibility");
    expect(settings().getByRole("tab", { selected: true }).textContent).toBe(
      "Conditions",
    );

    fireEvent.click(issueButton()!);
    fireEvent.click(issueList().getByRole("button", { name: /^Variables/ }));
    expect(screen.queryByRole("region", { name: "Form canvas" })).toBeNull();
    expect(screen.getByDisplayValue("bad name")).toBeTruthy();
  });

  it("closes the list on Escape, with focus still on its toggle", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(issueButton()!);
    fireEvent.keyDown(issueButton()!, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Issues" })).toBeNull();
  });

  it("returns focus to its toggle on Escape from a list Save opened", async () => {
    renderFormBuilder(readsMissing);
    edit();
    await save();
    fireEvent.keyDown(screen.getByRole("region", { name: "Issues" }), {
      key: "Escape",
    });

    expect(screen.queryByRole("region", { name: "Issues" })).toBeNull();
    expect(document.activeElement).toBe(issueButton());
  });

  it("closes the list on a click outside it", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(issueButton()!);
    fireEvent.mouseDown(screen.getByRole("region", { name: "Issues" }));
    expect(screen.getByRole("region", { name: "Issues" })).toBeTruthy();

    fireEvent.mouseDown(canvas().getByText("Label a"));
    expect(screen.queryByRole("region", { name: "Issues" })).toBeNull();
  });

  it("offers to retry a form that didn't load, and blocks Save meanwhile", async () => {
    failing.add("5");
    renderSavedFormBuilder(5, "/");
    await screen.findByRole("button", { name: "1 issue" });
    edit();
    await save();
    expect(issueList().getByText("Fix 1 issue before saving")).toBeTruthy();
    expect(issueList().getByText("The form didn't load")).toBeTruthy();
    expect(writes).toEqual([]);

    failing.clear();
    const retry = issueList().getByRole("button", {
      name: "Discard edits and retry",
    });
    retry.focus();
    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() => expect(issueButton()).toBeNull());
    expect(outline().getByRole("button", { name: "Two" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Issues" }),
    );
  });

  it("retries a form that didn't load from its error", async () => {
    failing.add("5");
    renderSavedFormBuilder(5, "/");
    await screen.findByText(/^Error loading form/);

    failing.clear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(issueButton()).toBeNull());
    expect(screen.queryByText(/^Error loading form/)).toBeNull();
  });

  it("clears what the editors held for the blank form once a retry loads it", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    failing.add("7");
    renderSavedFormBuilder(7, "/");
    await screen.findByRole("button", { name: "1 issue" });
    fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
      target: { value: JSON.stringify(withVariable("mine")) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const confirm = await screen.findByRole("button", {
      name: "Apply id and kind changes",
    });
    await act(async () => {
      fireEvent.click(confirm);
    });
    fireEvent.click(screen.getByRole("button", { name: /^Variables/ }));
    fireEvent.change(screen.getByLabelText("Sample answer for input1"), {
      target: { value: "Oslo" },
    });

    failing.clear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Discard edits and retry" }),
      );
    });
    await waitFor(() => expect(issueButton()).toBeNull());
    expect(screen.getByDisplayValue("stored")).toBeTruthy();
    expect(
      screen.getByLabelText<HTMLInputElement>("Sample answer for input1").value,
    ).toBe("");
  });

  it("blocks Preview on a form that didn't load", async () => {
    failing.add("5");
    renderSavedFormBuilder(5, "/");
    await screen.findByRole("button", { name: "1 issue" });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(issueList().getByText("Fix 1 issue before previewing")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("blocks Save on a form that didn't load while a formula's source form loads", async () => {
    failing.add("5");
    api.alsoServing({
      "GET /tasks/slug/:id": ({ params }) =>
        params.id === "9"
          ? new Promise<Response>(() => {})
          : new Response(null, { status: 500 }),
    });
    renderSavedFormBuilder(5, "/");
    await screen.findByRole("button", { name: "1 issue" });
    fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
      target: {
        value: JSON.stringify({
          pages: [{ id: "page-1", fields: [] }],
          outputViews: [],
          aggregateViews: [],
          variables: [
            {
              name: "scores",
              inputs: {
                input1: {
                  kind: "sourceField",
                  sourceFormId: 9,
                  fieldId: "score",
                },
              },
              formula: "input1.length",
            },
          ],
        }),
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
    edit();
    await save();

    expect(issueList().getByText("The form didn't load")).toBeTruthy();
    expect(writes).toEqual([]);
  });

  it("lets Preview open while the questions of a form a formula reads load", () => {
    api.alsoServing({
      "GET /tasks/slug/:id": () => new Promise<Response>(() => {}),
    });
    renderFormBuilder(readsForm9);
    expect(screen.getByRole("button", { name: "Checking" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("leaves Preview for an issue that appears there", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.alsoServing({
      "GET /tasks/slug/:id": async () => {
        await held;
        return Response.json({
          id: 9,
          schema: twoPages([]),
          formSnapshotId: 3,
        });
      },
    });
    renderFormBuilder(
      twoPages([
        {
          id: "pick",
          type: "input",
          kind: "select",
          label: "Pick",
          options: [],
          optionsFormula: {
            inputs: {
              input1: { kind: "sourceField", sourceFormId: 9, fieldId: "nope" },
            },
            formula: "[]",
          },
        },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await act(async () => release());
    fireEvent.click(await screen.findByRole("button", { name: "1 issue" }));
    fireEvent.click(issueList().getByText("Two › Select Field: Pick"));

    expect(canvas().getByText("Pick")).toBeTruthy();
  });

  it("keeps focus on Retry when the questions of a form a formula reads fail again", async () => {
    let loads = 0;
    api.alsoServing({
      "GET /tasks/slug/:id": () => {
        loads += 1;
        return new Response(null, { status: 500 });
      },
    });
    renderFormBuilder(readsForm9);
    fireEvent.click(await screen.findByRole("button", { name: "1 issue" }));

    const retry = issueList().getByRole("button", { name: "Retry" });
    retry.focus();
    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() => expect(loads).toBe(2));
    await act(async () => {});
    expect(retry.isConnected).toBe(true);
    expect(document.activeElement).toBe(retry);
  });

  it("leaves focus off the list when it reopens after closing with focus inside", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(screen.getByRole("button", { name: "1 issue" }));
    within(issueList().getByRole("listitem")).getByRole("button").focus();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("region", { name: "Issues" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "1 issue" }));
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves focus in the sidebar when deleting from it with the list open", () => {
    renderFormBuilder(readsMissing);
    fireEvent.click(screen.getByRole("button", { name: "1 issue" }));
    selectElement("Label a");
    openSection("Advanced");
    const remove = screen.getByRole("button", { name: "Delete question" });
    remove.focus();
    fireEvent.click(remove);
    expect(heading()).toBe("Page settings");
    expect(
      screen
        .getByRole("complementary", { name: "Settings" })
        .contains(document.activeElement),
    ).toBe(true);
  });

  it("offers to retry the questions of a form a formula reads, keeping focus in the list", async () => {
    failing.add("9");
    renderFormBuilder(readsForm9);
    fireEvent.click(await screen.findByRole("button", { name: "1 issue" }));
    expect(
      issueList().getByText(
        "Couldn't load the questions of 1 form that formulas read.",
      ),
    ).toBeTruthy();

    failing.clear();
    const retry = issueList().getByRole("button", { name: "Retry" });
    retry.focus();
    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() =>
      expect(issueList().getByText("No issues")).toBeTruthy(),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Issues" }),
    );
  });

  it("shows an output block's expression whose rules are all gone", () => {
    const dangling: VisibleIfFormula = { conditions: {}, formula: "c1" };
    renderFormBuilder({
      ...twoPages([]),
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [
            { id: "b1", fieldId: "a", visibleIfFormula: dangling },
            {
              id: "b2",
              type: "display",
              kind: "header",
              text: "Heading",
              visibleIfFormula: dangling,
            },
          ],
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Output View" }));

    expect(screen.getAllByRole("textbox", { name: "Expression" })).toHaveLength(
      2,
    );
  });
});
