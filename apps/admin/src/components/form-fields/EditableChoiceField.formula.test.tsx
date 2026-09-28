import {
  anyFieldSchema,
  type AnyField,
  type SelectField,
} from "@alliance/common/forms/form-schema";
import type { ChoiceField } from "@alliance/common/forms/formula-options";
import { variableFieldScope } from "@alliance/common/forms/variable-scope";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { FormulaSourcesProvider } from "../FormulaSourcesContext";
import { inputHelp } from "../variableInputHelp";
import type { InputSources } from "../VariableInputPickers";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableChoiceField } from "./EditableChoiceField";

afterEach(cleanup);
serveApi(routes({}));

const SOURCE = 7;

const colors: AnyField = {
  id: "colors",
  type: "input",
  kind: "multiselect",
  label: "Colors",
  options: [{ label: "Red", value: "red" }],
};

const ownPick: AnyField = {
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  options: [],
};

const otherColors: AnyField = { ...colors, id: "other", label: "Other" };

const sources: InputSources = {
  fieldsFor: (sourceFormId) =>
    sourceFormId === SOURCE ? [colors] : [ownPick, otherColors],
  statusOf: () => undefined,
  forms: [{ id: SOURCE, title: "Colors form" }],
  ownForm: undefined,
  formsLoaded: true,
  scope: variableFieldScope(
    { pages: [], outputViews: [] },
    new Map([[SOURCE, [colors]]]),
  ),
};

const fixed: SelectField = {
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  defaultValue: "a",
  options: [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ],
};

let latest: ChoiceField = fixed;

function Editor({
  start,
  formListFailed = false,
  formSources = sources,
}: {
  start: ChoiceField;
  formListFailed?: boolean;
  formSources?: InputSources;
}) {
  const [field, setField] = useState(start);
  latest = field;
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <CustomValidatorDraftsContext.Provider
            value={{
              drafts: {},
              setDraft() {},
              removeDraft() {},
              createDraftId: () => -1,
            }}
          >
            <FormulaSourcesProvider
              value={{ sources: formSources, formListFailed }}
            >
              <EditableChoiceField
                field={field}
                onUpdate={(updates) =>
                  setField((prev) => ({ ...prev, ...updates }))
                }
                onRemove={() => {}}
              />
            </FormulaSourcesProvider>
          </CustomValidatorDraftsContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const withFormula = (formula: string): SelectField => ({
  ...fixed,
  defaultValue: undefined,
  options: [],
  optionsFormula: {
    inputs: {
      input1: { kind: "sourceField", sourceFormId: SOURCE, fieldId: "colors" },
    },
    formula,
  },
});

it("asks before replacing fixed options with a formula, then drops them with the default", () => {
  render(<Editor start={fixed} />);

  expect(screen.getByRole("group", { name: "Options from" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Formula" }));
  expect(
    screen.getByText("This removes the 2 fixed options and the default."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(latest.options).toEqual([]);
  expect(latest.optionsFormula).toEqual({ inputs: {}, formula: "[]" });
  expect(anyFieldSchema.safeParse(latest).success).toBe(true);
  expect(screen.queryByPlaceholderText("Option label")).toBeNull();
});

it("drops a multiselect's default along with its fixed options", () => {
  render(
    <Editor
      start={{
        ...fixed,
        kind: "multiselect",
        defaultValue: ["a", "b"],
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Formula" }));
  expect(
    screen.getByText("This removes the 2 fixed options and the default."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(latest.kind).toBe("multiselect");
  expect(latest.defaultValue).toBeUndefined();
  expect(anyFieldSchema.safeParse(latest).success).toBe(true);
});

it("asks before dropping categories that hold no options", () => {
  render(
    <Editor
      start={{
        ...fixed,
        defaultValue: undefined,
        options: [],
        categories: [{ id: "warm", name: "Warm" }],
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Formula" }));
  expect(screen.getByText("This removes the option categories.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(latest.categories).toBeUndefined();
  expect(anyFieldSchema.safeParse(latest).success).toBe(true);
});

it("goes back to a fixed list from an untouched formula without asking", () => {
  render(
    <Editor
      start={{
        ...withFormula("[]"),
        optionsFormula: { inputs: {}, formula: "[]" },
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Fixed list" }));

  expect(latest.optionsFormula).toBeUndefined();
  expect(latest.options).toEqual([{ label: "Option 1", value: "option1" }]);
  expect(anyFieldSchema.safeParse(latest).success).toBe(true);
});

it("asks before replacing a written formula with a fixed list", () => {
  const start = withFormula("input1.at(-1) ?? []");
  render(<Editor start={start} />);

  fireEvent.click(screen.getByRole("button", { name: "Fixed list" }));
  expect(
    screen.getByText("This removes the formula and its inputs."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(latest.optionsFormula).toEqual(start.optionsFormula);

  fireEvent.click(screen.getByRole("button", { name: "Fixed list" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(latest.optionsFormula).toBeUndefined();
  expect(latest.options).toEqual([{ label: "Option 1", value: "option1" }]);
});

it("says when the list of forms a formula reads can't load", () => {
  render(<Editor start={withFormula("[]")} formListFailed />);

  expect(screen.getByText("Could not load the list of forms.")).toBeTruthy();
});

it("previews the options with repeated values merged", () => {
  render(
    <Editor
      start={withFormula(
        "[{ label: 'First', value: 'a' }, { label: 'Second', value: 'a' }, { label: 'Other', value: 'b' }]",
      )}
    />,
  );

  const chips = screen.getAllByRole("listitem");
  expect(chips.map((chip) => chip.textContent)).toEqual(["First a", "Other b"]);
});

it("says when the formula doesn't give a list of choices", () => {
  render(<Editor start={withFormula("input1")} />);

  expect(
    screen.getByText(/has to give a list of \{ label, value \} records/),
  ).toBeTruthy();
});

it("offers the latest and all-submission recipes for a multiselect read from another form", () => {
  render(<Editor start={withFormula("[]")} />);

  fireEvent.click(
    screen.getByRole("button", { name: "What you can write here" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "input1.at(-1) ?? []" }));

  expect(latest.optionsFormula?.formula).toBe("input1.at(-1) ?? []");
  fireEvent.click(
    screen.getByRole("button", { name: "What you can write here" }),
  );
  expect(
    screen.getByRole("button", {
      name: "input1.flatMap(answer => answer ?? [])",
    }),
  ).toBeTruthy();
});

it("tells an unanswered input to give no choices, not text", () => {
  render(<Editor start={withFormula("[]")} />);

  fireEvent.click(
    screen.getByRole("button", { name: "What you can write here" }),
  );

  expect(screen.getByText("input1 ?? []")).toBeTruthy();
  expect(screen.queryByText("input1 ?? 'n/a'")).toBeNull();
});

it("doesn't let an input count members' answers", () => {
  render(<Editor start={withFormula("[]")} />);

  const counts = screen.getByRole<HTMLOptionElement>("option", {
    name: "Aggregate counts",
  });
  expect(counts.disabled).toBe(true);
});

it("doesn't offer the field its own options formula gives options to", () => {
  render(<Editor start={withFormula("[]")} />);

  fireEvent.click(screen.getByRole("button", { name: "Add input" }));

  expect(latest.optionsFormula?.inputs.input2).toMatchObject({
    fieldId: "other",
  });
});

it("doesn't offer the list holding the field", () => {
  const list: AnyField = {
    id: "rows",
    type: "input",
    kind: "list",
    label: "Rows",
    fields: [ownPick],
  };
  render(
    <Editor
      start={withFormula("[]")}
      formSources={{
        ...sources,
        fieldsFor: (sourceFormId) =>
          sourceFormId === SOURCE ? [colors] : [list, otherColors],
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add input" }));

  expect(latest.optionsFormula?.inputs.input2).toMatchObject({
    fieldId: "other",
  });
});

it("leaves text examples out of an options formula's help", () => {
  const start = withFormula("[]");
  const textExample = inputHelp(
    start.optionsFormula!.inputs.input1,
    colors,
  ).example("input1");
  render(<Editor start={start} />);

  fireEvent.click(
    screen.getByRole("button", { name: "What you can write here" }),
  );

  expect(textExample).not.toBe("");
  expect(screen.queryByRole("button", { name: textExample })).toBeNull();
});
