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
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

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

const writes: string[] = [];
const failing = new Set<string>();
const savedForms: Record<string, FormSchema> = { 5: twoPages([text("b")]) };

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

  it("lets Preview open while the questions of a form a formula reads load", () => {
    api.alsoServing({
      "GET /tasks/slug/:id": () => new Promise<Response>(() => {}),
    });
    renderFormBuilder({
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
    });
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

  it("offers to retry the questions of a form a formula reads", async () => {
    failing.add("9");
    renderFormBuilder({
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
    });
    fireEvent.click(await screen.findByRole("button", { name: "1 issue" }));
    expect(
      issueList().getByText(
        "Couldn't load the questions of 1 form that formulas read.",
      ),
    ).toBeTruthy();

    failing.clear();
    await act(async () => {
      fireEvent.click(issueList().getByRole("button", { name: "Retry" }));
    });
    await waitFor(() =>
      expect(issueList().getByText("No issues")).toBeTruthy(),
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
