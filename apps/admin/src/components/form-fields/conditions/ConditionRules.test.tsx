import {
  SelectedCountComparison,
  type Condition,
} from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { resetCustomValidatorsCache } from "../CommonControls";
import {
  addRule,
  color,
  formulaMultiselect,
  formulaOf,
  formulaSelect,
  isRed,
  latest,
  renderEditor,
  rule,
  share,
  staticMultiselect,
} from "./conditionEditorTesting";

afterEach(cleanup);
const api = serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([{ id: 9, title: "Intake" }]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

describe("answer rules", () => {
  it("keeps an unavailable question visible instead of showing another", () => {
    renderEditor({
      initial: {
        conditions: { c1: { ...isRed, when: "gone" } },
        formula: "c1",
      },
    });
    expect(
      rule("c1").getByDisplayValue("Unavailable question (gone)"),
    ).toBeTruthy();
    expect(
      rule("c1").getByText(/The rule still checks: gone is "red"/),
    ).toBeTruthy();
  });

  it("types the value a rule on a formula select matches", async () => {
    renderEditor({ previous: [formulaSelect] });
    await addRule("Answer on this form");
    expect(screen.getByText("Type the value to match.")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Value" }), {
      target: { value: "red" },
    });
    expect(latest()?.conditions.condition1).toEqual({
      kind: "equals",
      when: "pick",
      equals: "red",
    });
  });

  it("starts a formula multiselect at any selection, then types an included value", async () => {
    renderEditor({ previous: [formulaMultiselect] });
    await addRule("Answer on this form");
    expect(latest()?.conditions.condition1).toEqual({
      kind: "anySelected",
      when: "tags",
      anySelected: true,
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Comparison" }), {
      target: { value: "includes" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Value" }), {
      target: { value: "red" },
    });
    expect(latest()?.conditions.condition1).toEqual({
      kind: "includesOption",
      when: "tags",
      includesOption: "red",
    });
  });

  it("checks that a choice question is unanswered", async () => {
    renderEditor();
    await addRule("Answer on this form");
    fireEvent.change(screen.getByRole("combobox", { name: "Comparison" }), {
      target: { value: "unanswered" },
    });
    expect(latest()?.conditions.condition1).toEqual({
      kind: "hasValue",
      when: "color",
      hasValue: false,
    });
    expect(screen.queryByRole("combobox", { name: "Value" })).toBeNull();
  });

  it("keeps the saved count while its input is cleared or fractional", async () => {
    renderEditor({ previous: [staticMultiselect] });
    await addRule("Answer on this form");
    fireEvent.change(screen.getByRole("combobox", { name: "Comparison" }), {
      target: { value: "selectedCount" },
    });
    const input = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: "Number of options selected",
    });

    for (const typed of ["", "2.5", "3"]) {
      fireEvent.change(input, { target: { value: typed } });
      expect(input.value).toBe(typed);
    }
    expect(latest()?.conditions.condition1).toMatchObject({ count: 3 });

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3");
    expect(latest()?.conditions.condition1).toMatchObject({ count: 3 });
  });

  it("retries a failed form list from the Add rule menu", async () => {
    let loads = 0;
    api.alsoServing({
      "GET /tasks/listForms": () => {
        loads += 1;
        return loads === 1
          ? Response.json({ message: "boom" }, { status: 500 })
          : Response.json([{ id: 9, title: "Intake" }]);
      },
      "GET /tasks/slug/:id": () =>
        Response.json({ message: "Form not found" }, { status: 404 }),
    });
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.queryByText("Could not load forms")).toBeNull(),
    );
    await addRule("Answer on another form");
    expect(latest()?.conditions.condition1).toMatchObject({ sourceFormId: 9 });
  });

  it("counts a multiselect's selections", async () => {
    renderEditor({ previous: [staticMultiselect] });
    await addRule("Answer on this form");
    fireEvent.change(screen.getByRole("combobox", { name: "Comparison" }), {
      target: { value: "selectedCount" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Count comparison" }),
      {
        target: { value: SelectedCountComparison.LessThan },
      },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Number of options selected" }),
      { target: { value: "3" } },
    );
    expect(latest()?.conditions.condition1).toEqual({
      kind: "selectedCount",
      when: "colors",
      comparison: SelectedCountComparison.LessThan,
      count: 3,
    });
  });

  it("checks whether a custom component is answered", async () => {
    renderEditor({ previous: [share] });
    await addRule("Answer on this form");
    expect(latest()?.conditions.condition1).toEqual({
      kind: "hasValue",
      when: "share",
      hasValue: true,
    });
  });

  it("lists later fields under their own heading and warns when one is picked", async () => {
    renderEditor({ later: [share] });
    await addRule("Answer on this form");
    const laterGroup = screen.getByRole("group", { name: "Later in form" });
    expect(laterGroup.querySelector('option[value="share"]')).toBeTruthy();
    expect(screen.queryByText(/comes later in the form/)).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Question" }), {
      target: { value: "share" },
    });
    expect(latest()?.conditions.condition1).toMatchObject({ when: "share" });
    expect(screen.getByText(/comes later in the form/)).toBeTruthy();
  });

  it("keeps a cross-form rule while its form fails to load, and retries", async () => {
    let loads = 0;
    api.alsoServing({
      "GET /tasks/slug/:id": () => {
        loads += 1;
        return loads === 1
          ? Response.json({ message: "boom" }, { status: 500 })
          : Response.json({
              id: 9,
              title: "Intake",
              formSnapshotId: 1,
              schema: {
                pages: [{ id: "p", title: "P", fields: [color] }],
                outputViews: [],
                aggregateViews: [],
              },
            });
      },
    });
    const remote: Condition = { ...isRed, sourceFormId: 9 };
    renderEditor({ initial: { conditions: { c1: remote }, formula: "c1" } });

    fireEvent.click(await rule("c1").findByRole("button", { name: "Retry" }));
    expect(await rule("c1").findByDisplayValue("Red")).toBeTruthy();
    expect(latest()?.conditions.c1).toEqual(remote);
    expect(rule("c1").getByText("Answer on another form")).toBeTruthy();
  });
});

it("starts a cross-form rule over afresh when its source form changes", async () => {
  api.alsoServing({
    "GET /tasks/listForms": () =>
      Response.json([
        { id: 9, title: "Intake" },
        { id: 12, title: "Follow-up" },
      ]),
    "GET /tasks/slug/:id": ({ params }) =>
      Response.json({
        id: Number(params.id),
        title: "Form",
        formSnapshotId: 1,
        schema: {
          pages: [{ id: "p", title: "P", fields: [color] }],
          outputViews: [],
          aggregateViews: [],
        },
      }),
  });
  renderEditor({
    initial: {
      conditions: { c1: { ...isRed, sourceFormId: 9 } },
      formula: "c1",
    },
  });
  await rule("c1").findByRole("option", { name: "Follow-up (#12)" });

  fireEvent.change(rule("c1").getByRole("combobox", { name: "Source form" }), {
    target: { value: "12" },
  });
  expect(latest()?.conditions.c1).toEqual({
    kind: "hasValue",
    when: "",
    hasValue: true,
    sourceFormId: 12,
  });
  expect(await rule("c1").findByDisplayValue("Choose a question")).toBeTruthy();
});

it("describes a negated rule on an unavailable question with its NOT", () => {
  renderEditor({
    initial: {
      conditions: { c1: { ...isRed, when: "gone" }, c2: { ...isRed } },
      formula: formulaOf("NOT c1 AND c2"),
    },
  });
  expect(
    rule("c1").getByText(/The rule still checks: NOT gone is "red"/),
  ).toBeTruthy();
});

it("matches a typed answer on a text question without mentioning formulas", () => {
  renderEditor({
    initial: {
      conditions: { c1: { kind: "equals", when: "name", equals: "Ada" } },
      formula: "c1",
    },
  });
  expect(rule("c1").getByText("Matches this exact answer.")).toBeTruthy();
});

describe("other rules", () => {
  it("keeps NOT over a validator in the expression, retrying a failed lookup", async () => {
    let loads = 0;
    api.alsoServing({
      "GET /user/list": () => Response.json([]),
      "GET /tasks/findOneCustomValidator/:id": () => {
        loads += 1;
        return loads === 1
          ? Response.json({ message: "boom" }, { status: 500 })
          : Response.json({
              id: 4,
              type: "CustomExpression",
              idArgument: null,
              expression: "true",
            });
      },
    });
    const formula = formulaOf("NOT v");
    renderEditor({
      initial: {
        conditions: { v: { kind: "validator", validatorId: 4 } },
        formula,
      },
    });
    expect(screen.getByRole("textbox", { name: "Expression" })).toBeTruthy();
    expect(rule("v").getByDisplayValue("passes")).toBeTruthy();

    fireEvent.click(await rule("v").findByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(rule("v").queryByText("Could not load validator 4.")).toBeNull(),
    );
    expect(rule("v").queryByText("Loading validator details…")).toBeNull();
    expect(
      rule("v").getByRole<HTMLOptionElement>("option", { name: "None" })
        .disabled,
    ).toBe(true);

    fireEvent.change(
      rule("v").getByRole("combobox", { name: "Validator result" }),
      { target: { value: "false" } },
    );
    expect(latest()).toEqual({
      conditions: {
        v: { kind: "validator", validatorId: 4, resultEquals: false },
      },
      formula,
    });
  });

  it("moves an edited saved validator to a new draft", async () => {
    resetCustomValidatorsCache();
    api.alsoServing({
      "GET /tasks/customValidators": () =>
        Response.json([
          {
            name: "Has phone number",
            id: "HasPhoneNumber",
            withIdField: false,
            usableForVisibility: true,
          },
          {
            name: "Uploaded photo",
            id: "UploadedPhoto",
            withIdField: false,
            usableForVisibility: true,
          },
        ]),
      "GET /tasks/findOneCustomValidator/:id": () =>
        Response.json({
          id: 4,
          type: "HasPhoneNumber",
          idArgument: null,
          expression: null,
        }),
    });
    const setDraft = jest.fn();
    renderEditor(
      {
        initial: {
          conditions: { v: { kind: "validator", validatorId: 4 } },
          formula: "v",
        },
      },
      { drafts: {}, setDraft, removeDraft() {}, createDraftId: () => -9 },
    );

    fireEvent.change(await rule("v").findByDisplayValue("Has phone number"), {
      target: { value: "UploadedPhoto" },
    });
    expect(setDraft).toHaveBeenCalledWith(-9, {
      type: "UploadedPhoto",
      idArgument: null,
      expression: null,
    });
    expect(latest()).toEqual({
      conditions: { v: { kind: "validator", validatorId: -9 } },
      formula: "v",
    });
    resetCustomValidatorsCache();
  });

  it("registers a draft for a new validator rule and drops it with the rule", async () => {
    resetCustomValidatorsCache();
    api.alsoServing({
      "GET /tasks/customValidators": () =>
        Response.json([
          {
            name: "Has phone number",
            id: "HasPhoneNumber",
            withIdField: false,
            usableForVisibility: true,
          },
        ]),
    });
    const setDraft = jest.fn();
    const removeDraft = jest.fn();
    renderEditor(
      {},
      { drafts: {}, setDraft, removeDraft, createDraftId: () => -7 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Validator" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(setDraft).toHaveBeenCalledWith(-7, {
      type: "HasPhoneNumber",
      idArgument: null,
      expression: null,
    });
    expect(latest()?.conditions.condition1).toEqual({
      kind: "validator",
      validatorId: -7,
      resultEquals: true,
    });

    fireEvent.click(
      rule("condition1").getByRole("button", { name: "Remove rule" }),
    );
    expect(removeDraft).toHaveBeenCalledWith(-7);
    expect(latest()).toBeUndefined();
    resetCustomValidatorsCache();
  });

  it("offers output-block rules instead of account rules in an output view", async () => {
    renderEditor({
      outputBlocks: [
        { id: "self", label: "This block" },
        { id: "other", label: "Other block" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(
      await screen.findByRole("menuitem", { name: "Output block visibility" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "User property" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Output block visibility" }),
    );
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    expect(latest()?.conditions.condition1).toEqual({
      kind: "outputBlockVisible",
      outputBlockVisible: "other",
      isVisible: true,
    });
    expect(
      rule("condition1").getByRole<HTMLOptionElement>("option", {
        name: /This block/,
      }).disabled,
    ).toBe(true);
  });
});
