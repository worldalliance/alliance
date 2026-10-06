import type {
  CheckboxField,
  ContractField,
  NumberField,
  RangeField,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { addRule, latest, renderEditor } from "./conditionEditorTesting";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

const agree: CheckboxField = {
  id: "agree",
  type: "input",
  kind: "checkbox",
  label: "Agree",
};

const score: RangeField = {
  id: "score",
  type: "input",
  kind: "range",
  label: "Score",
  optionCount: 3,
};

describe("literal values", () => {
  const age: NumberField = {
    id: "age",
    type: "input",
    kind: "number",
    label: "Age",
    min: 18,
  };
  const agreement: ContractField = {
    id: "agreement",
    type: "input",
    kind: "contract",
    label: "Agreement",
    contractId: null,
    signQuestion: "Do you agree?",
    yesLabel: "I agree",
    noLabel: "I decline",
  };

  it("keeps the saved number while its input is cleared", async () => {
    renderEditor({ previous: [age] });
    await addRule("Answer on this form");
    const input = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: "Value",
    });
    expect(input.value).toBe("18");

    fireEvent.change(input, { target: { value: "" } });
    expect(latest()?.conditions.condition1).toMatchObject({ equals: 18 });
    fireEvent.change(input, { target: { value: "21.5" } });
    expect(latest()?.conditions.condition1).toMatchObject({ equals: 21.5 });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("21.5");
  });

  it("offers a contract's own answer labels as booleans", async () => {
    renderEditor({ previous: [agreement] });
    await addRule("Answer on this form");
    fireEvent.change(screen.getByRole("combobox", { name: "Value" }), {
      target: { value: "false" },
    });
    expect(latest()?.conditions.condition1).toEqual({
      kind: "equals",
      when: "agreement",
      equals: false,
    });
    expect(screen.getByDisplayValue("I decline")).toBeTruthy();
  });

  it("checks a checkbox as checked or unchecked", async () => {
    renderEditor({ previous: [agree] });
    await addRule("Answer on this form");
    expect(latest()?.conditions.condition1).toEqual({
      kind: "equals",
      when: "agree",
      equals: true,
    });
    expect(screen.queryByRole("option", { name: "is not" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Value" }), {
      target: { value: "false" },
    });
    expect(latest()?.conditions.condition1).toMatchObject({ equals: false });
    expect(screen.getByDisplayValue("Unchecked")).toBeTruthy();
  });

  it("lists a range's values and saves the picked one as a number", async () => {
    renderEditor({ previous: [score] });
    await addRule("Answer on this form");
    expect(latest()?.conditions.condition1).toMatchObject({ equals: 1 });
    const options = screen
      .getAllByRole<HTMLOptionElement>("option")
      .filter(
        (option) =>
          option.parentElement?.getAttribute("aria-label") === "Value",
      )
      .map((option) => option.value);
    expect(options).toEqual(["1", "2", "3"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Value" }), {
      target: { value: "3" },
    });
    expect(latest()?.conditions.condition1).toMatchObject({ equals: 3 });
  });

  it("starts a number rule at the question's default value", async () => {
    renderEditor({ previous: [{ ...age, defaultValue: 30 }] });
    await addRule("Answer on this form");
    expect(latest()?.conditions.condition1).toMatchObject({ equals: 30 });
  });
});
