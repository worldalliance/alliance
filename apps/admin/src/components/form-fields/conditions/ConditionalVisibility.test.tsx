import { UserValueProperty } from "@alliance/common/forms/user-properties";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import {
  addRule,
  expression,
  formulaOf,
  isRed,
  latest,
  named,
  renderEditor,
  rule,
} from "./conditionEditorTesting";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([{ id: 9, title: "Intake" }]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

describe("simple rules", () => {
  it("adds the first rule, then removes it back to unconditional", async () => {
    renderEditor();
    expect(screen.getByText(/^Always shown/)).toBeTruthy();

    await addRule("Answer on this form");
    expect(latest()).toEqual({
      conditions: { condition1: isRed },
      formula: "condition1",
    });

    fireEvent.click(
      rule("condition1").getByRole("button", { name: "Remove rule" }),
    );
    expect(latest()).toBeUndefined();
  });

  it("shows a single condition with its option label", () => {
    renderEditor({ initial: { conditions: { c1: isRed }, formula: "c1" } });
    expect(screen.queryByRole("textbox", { name: "Expression" })).toBeNull();
    expect(
      screen.queryByRole("combobox", { name: "Combine rules" }),
    ).toBeNull();
    expect(rule("c1").getByDisplayValue("Red")).toBeTruthy();
    expect(rule("c1").getByDisplayValue("is")).toBeTruthy();
  });

  it("switches an AND formula to OR without touching its conditions", () => {
    const conditions = { c1: isRed, c2: named };
    renderEditor({ initial: { conditions, formula: formulaOf("c1 AND c2") } });
    const combine = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Combine rules",
    });
    expect(combine.value).toBe("AND");

    fireEvent.change(combine, { target: { value: "OR" } });
    expect(latest()).toEqual({ conditions, formula: formulaOf("c1 OR c2") });
  });

  it("reads an OR formula as any rule", () => {
    renderEditor({
      initial: {
        conditions: { c1: isRed, c2: named },
        formula: formulaOf("c1 OR c2"),
      },
    });
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Combine rules" })
        .value,
    ).toBe("OR");
  });

  it("shows a negated rule as its negative comparison and keeps the formula on a value edit", () => {
    const formula = formulaOf("c1 AND NOT c2");
    renderEditor({
      initial: {
        conditions: { c1: named, c2: isRed },
        formula,
      },
    });
    expect(rule("c2").getByDisplayValue("is not")).toBeTruthy();

    fireEvent.change(rule("c2").getByRole("combobox", { name: "Value" }), {
      target: { value: "blue" },
    });
    expect(latest()?.formula).toBe(formula);
    expect(latest()?.conditions.c2).toEqual({ ...isRed, equals: "blue" });
  });

  it("round-trips a rule through its negative comparison", () => {
    renderEditor({
      initial: {
        conditions: { c1: named, c2: isRed },
        formula: formulaOf("c1 OR c2"),
      },
    });
    const comparison = () =>
      rule("c2").getByRole("combobox", { name: "Comparison" });

    fireEvent.change(comparison(), { target: { value: "isNot" } });
    expect(latest()?.formula).toEqual(formulaOf("c1 OR NOT c2"));
    expect(latest()?.conditions.c2).toEqual(isRed);

    fireEvent.change(comparison(), { target: { value: "is" } });
    expect(latest()?.formula).toEqual(formulaOf("c1 OR c2"));
  });

  it("shows NOT over an answered check as unanswered", () => {
    renderEditor({
      initial: { conditions: { c1: named }, formula: formulaOf("NOT c1") },
    });
    expect(rule("c1").getByDisplayValue("is unanswered")).toBeTruthy();
  });

  it("names a new rule past every name in use and joins it with the chosen combinator", async () => {
    renderEditor({
      initial: {
        conditions: { condition3: named, c1: isRed },
        formula: formulaOf("condition3 OR c1"),
      },
    });
    await addRule("Device");
    expect(latest()?.formula).toEqual(
      formulaOf("condition3 OR c1 OR condition4"),
    );
    expect(latest()?.conditions.condition4).toEqual({
      kind: "deviceType",
      deviceType: ["mobile", "tablet", "desktop"],
    });
  });
});

describe("negative values", () => {
  it("shows NOT over a user property check as not set, and drops the NOT on an edit", () => {
    renderEditor({
      initial: {
        conditions: {
          c1: {
            kind: "userPropertyHasValue",
            property: UserValueProperty.City,
            hasValue: true,
          },
        },
        formula: formulaOf("NOT c1"),
      },
    });
    expect(rule("c1").getByDisplayValue("is not set")).toBeTruthy();

    fireEvent.change(
      rule("c1").getByRole("combobox", { name: "Property state" }),
      {
        target: { value: "true" },
      },
    );
    expect(latest()).toEqual({
      conditions: {
        c1: {
          kind: "userPropertyHasValue",
          property: UserValueProperty.City,
          hasValue: true,
        },
      },
      formula: "c1",
    });
  });

  it("shows NOT over an output-block check as hidden, and drops the NOT on an edit", () => {
    renderEditor({
      initial: {
        conditions: {
          c1: { kind: "outputBlockVisible", outputBlockVisible: "b1" },
        },
        formula: formulaOf("NOT c1"),
      },
      outputBlocks: [
        { id: "b1", label: "First" },
        { id: "b2", label: "Second" },
      ],
    });
    expect(
      rule("c1").getByDisplayValue("is hidden in this output view"),
    ).toBeTruthy();

    fireEvent.change(
      rule("c1").getByRole("combobox", { name: "Output block" }),
      {
        target: { value: "b2" },
      },
    );
    expect(latest()).toEqual({
      conditions: {
        c1: {
          kind: "outputBlockVisible",
          outputBlockVisible: "b2",
          isVisible: false,
        },
      },
      formula: "c1",
    });
  });
});

describe("expressions", () => {
  it("opens a group-negated formula in the expression editor", () => {
    const formula = formulaOf("NOT (c1 AND c2)");
    renderEditor({
      initial: { conditions: { c1: isRed, c2: named }, formula },
    });
    expect(expression().value).toBe("NOT (c1 AND c2)");
    expect(rule("c1").getByText("c1")).toBeTruthy();
    expect(rule("c1").queryByRole("option", { name: "is not" })).toBeNull();

    fireEvent.change(rule("c1").getByRole("combobox", { name: "Value" }), {
      target: { value: "blue" },
    });
    expect(latest()?.formula).toBe(formula);
    expect(expression().value).toBe("NOT (c1 AND c2)");
  });

  it("keeps typed text, saving it once it parses", () => {
    const conditions = { c1: isRed, c2: named };
    renderEditor({ initial: { conditions, formula: formulaOf("c1 AND c2") } });
    fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));

    fireEvent.change(expression(), { target: { value: "c1 or not" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "Unexpected end of formula.",
    );
    expect(latest()?.formula).toEqual(formulaOf("c1 AND c2"));

    fireEvent.change(expression(), { target: { value: "c1 or not c2" } });
    expect(latest()).toEqual({
      conditions,
      formula: formulaOf("c1 OR NOT c2"),
    });
    expect(expression().value).toBe("c1 or not c2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a rule the expression uses until the expression stops using it", () => {
    renderEditor({
      initial: {
        conditions: { c1: isRed, c2: named },
        formula: formulaOf("NOT c1 OR (c1 AND c2)"),
      },
    });
    expect(
      rule("c2").queryByRole("button", { name: "Remove rule" }),
    ).toBeNull();
    expect(rule("c2").getByText(/Used in the expression/)).toBeTruthy();

    fireEvent.change(expression(), { target: { value: "NOT c1 OR c1" } });
    fireEvent.click(rule("c2").getByRole("button", { name: "Remove rule" }));
    expect(latest()).toEqual({
      conditions: { c1: isRed },
      formula: formulaOf("NOT c1 OR c1"),
    });
  });

  it("holds text naming a missing rule without saving it", () => {
    const formula = formulaOf("c1 AND c2");
    renderEditor({
      initial: { conditions: { c1: isRed, c2: named }, formula },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));

    fireEvent.change(expression(), { target: { value: "c1 AND c9" } });
    expect(screen.getByRole("alert").textContent).toMatch(
      /No rule is named c9/,
    );
    expect(latest()?.formula).toBe(formula);
    expect(
      screen.queryByRole("button", { name: "Use all/any rules" }),
    ).toBeNull();

    fireEvent.change(expression(), { target: { value: "c1 AND c2" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Use all/any rules" }),
    ).toBeTruthy();
  });

  it("makes an added rule available to reference without changing the expression", async () => {
    const formula = formulaOf("NOT (c1 AND c2)");
    renderEditor({
      initial: { conditions: { c1: isRed, c2: named }, formula },
    });
    await addRule("Device");

    expect(latest()?.formula).toBe(formula);
    expect(Object.keys(latest()?.conditions ?? {})).toEqual([
      "c1",
      "c2",
      "condition1",
    ]);
    expect(
      rule("condition1").getByText(
        "The expression doesn't use condition1 yet.",
      ),
    ).toBeTruthy();
  });

  it("returns to rules only through an explicit combinator choice", () => {
    renderEditor({
      initial: {
        conditions: { c1: isRed, c2: named },
        formula: formulaOf("NOT (c1 AND c2)"),
      },
    });
    expect(
      screen.queryByRole("button", { name: "Use all/any rules" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Any rule" }));

    expect(latest()?.formula).toEqual(formulaOf("c1 OR c2"));
    expect(screen.queryByRole("textbox", { name: "Expression" })).toBeNull();
  });

  it("leaves an empty expression without asking for a replacement", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));
    expect(screen.queryByRole("button", { name: "All rules" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use all/any rules" }));
    expect(screen.getByText(/^Always shown/)).toBeTruthy();
  });

  it("leaves an expression that is still a rule list without replacing it", () => {
    renderEditor({ initial: { conditions: { c1: isRed }, formula: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));
    fireEvent.click(screen.getByRole("button", { name: "Use all/any rules" }));

    expect(latest()).toEqual({ conditions: { c1: isRed }, formula: "c1" });
    expect(screen.queryByRole("textbox", { name: "Expression" })).toBeNull();
  });
});
