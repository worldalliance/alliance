import type {
  AnyField,
  MultiSelectField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ConditionalVisibility } from "./CommonControls";
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
