import type {
  AnyField,
  ContractField,
  MultiSelectField,
  RangeField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import {
  SelectedCountComparison,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ConditionalVisibility } from "./CommonControls";
import {
  NO_VALUE_SELECTED,
  SELECTED_COUNT_VALUE,
} from "./FormulaChoiceConditionValue";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

const formula = { inputs: {}, formula: "[]" };

const formulaSelect: SelectField = {
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  options: [],
  optionsFormula: formula,
};

const formulaMultiselect: MultiSelectField = {
  id: "tags",
  type: "input",
  kind: "multiselect",
  label: "Tags",
  options: [],
  optionsFormula: formula,
};

const staticSelect: SelectField = {
  id: "color",
  type: "input",
  kind: "select",
  label: "Color",
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
};

const staticMultiselect: MultiSelectField = {
  ...staticSelect,
  id: "colors",
  kind: "multiselect",
};

const range: RangeField = {
  id: "score",
  type: "input",
  kind: "range",
  label: "Score",
  optionCount: 3,
};

const contract: ContractField = {
  id: "agreement",
  type: "input",
  kind: "contract",
  label: "Agreement",
  contractId: null,
  signQuestion: "Do you agree?",
  yesLabel: "I agree",
  noLabel: "I decline",
};

const dependent: AnyField = {
  id: "later",
  type: "input",
  kind: "text",
  label: "Later",
};

let latest: VisibleIfFormula | undefined;

function Editor({ controller }: { controller: AnyField }) {
  const [visibleIfFormula, setVisibleIfFormula] = useState<
    VisibleIfFormula | undefined
  >();
  latest = visibleIfFormula;
  return (
    <QueryClientProvider client={new QueryClient()}>
      <CustomValidatorDraftsContext.Provider
        value={{
          drafts: {},
          setDraft() {},
          removeDraft() {},
          createDraftId: () => -1,
        }}
      >
        <ConditionalVisibility
          field={{ ...dependent, visibleIfFormula }}
          previousFields={[controller]}
          onChange={(updates) => setVisibleIfFormula(updates.visibleIfFormula)}
        />
      </CustomValidatorDraftsContext.Provider>
    </QueryClientProvider>
  );
}

const conditionOf = () => Object.values(latest?.conditions ?? {})[0];

it("types the value a condition on a formula select matches", () => {
  render(<Editor controller={formulaSelect} />);

  fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Choice value" }), {
    target: { value: "red" },
  });

  expect(conditionOf()).toEqual({
    kind: "equals",
    when: "pick",
    equals: "red",
  });
});

it("starts a condition on a formula multiselect at any option, then types a value", () => {
  render(<Editor controller={formulaMultiselect} />);

  fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
  expect(conditionOf()).toEqual({
    kind: "anySelected",
    when: "tags",
    anySelected: true,
  });

  fireEvent.change(screen.getByRole("combobox", { name: "Match" }), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Choice value" }), {
    target: { value: "red" },
  });
  expect(conditionOf()).toEqual({
    kind: "includesOption",
    when: "tags",
    includesOption: "red",
  });
});

it("shows a field when a formula select has no option selected", () => {
  render(<Editor controller={formulaSelect} />);

  fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Match" }), {
    target: { value: NO_VALUE_SELECTED },
  });

  expect(conditionOf()).toEqual({
    kind: "hasValue",
    when: "pick",
    hasValue: false,
  });
  expect(screen.queryByRole("textbox", { name: "Choice value" })).toBeNull();
});

it("shows a field when a choice question has no option selected", () => {
  for (const [controller, initialChoice] of [
    [staticSelect, "Red"],
    [staticMultiselect, "Red"],
    [range, "1"],
    [contract, "I agree"],
  ] as const) {
    render(<Editor controller={controller} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
    fireEvent.change(screen.getByDisplayValue(initialChoice), {
      target: { value: NO_VALUE_SELECTED },
    });

    expect(conditionOf()).toEqual({
      kind: "hasValue",
      when: controller.id,
      hasValue: false,
    });
    expect(screen.getByDisplayValue("No option selected")).toBeTruthy();
    cleanup();
  }
});

it("shows a field when a multiselect has a number of options selected", () => {
  for (const [controller, initialChoice] of [
    [staticMultiselect, "Red"],
    [formulaMultiselect, "Any option selected"],
  ] as const) {
    render(<Editor controller={controller} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
    fireEvent.change(screen.getByDisplayValue(initialChoice), {
      target: { value: SELECTED_COUNT_VALUE },
    });
    expect(conditionOf()).toEqual({
      kind: "selectedCount",
      when: controller.id,
      comparison: SelectedCountComparison.AtLeast,
      count: 1,
    });
    expect(screen.getByDisplayValue("Number selected…")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Choice value" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Comparison" }), {
      target: { value: SelectedCountComparison.LessThan },
    });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Number of options selected" }),
      { target: { value: "3" } },
    );
    expect(conditionOf()).toEqual({
      kind: "selectedCount",
      when: controller.id,
      comparison: SelectedCountComparison.LessThan,
      count: 3,
    });
    cleanup();
  }
});

it("keeps the saved count while its input is cleared or fractional", () => {
  render(<Editor controller={staticMultiselect} />);
  fireEvent.click(screen.getByRole("button", { name: "+ Field condition" }));
  fireEvent.change(screen.getByDisplayValue("Red"), {
    target: { value: SELECTED_COUNT_VALUE },
  });
  const input = screen.getByRole<HTMLInputElement>("spinbutton", {
    name: "Number of options selected",
  });

  for (const typed of ["", "2.5", "3"]) {
    fireEvent.change(input, { target: { value: typed } });
    expect(input.value).toBe(typed);
  }
  expect(conditionOf()).toMatchObject({ count: 3 });

  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(input.value).toBe("3");
  expect(conditionOf()).toMatchObject({ count: 3 });
});
