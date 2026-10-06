import type {
  AnyField,
  CustomComponentField,
  MultiSelectField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import type {
  Condition,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { parseVisibilityFormula } from "@alliance/shared/forms/visibilityFormula";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import {
  CustomValidatorDraftsContext,
  type CustomValidatorDraftsContextValue,
} from "../customValidatorDrafts";
import { ConditionalVisibility } from "./ConditionalVisibility";
import type { OutputBlockOption } from "./ContextRules";

export const color: SelectField = {
  id: "color",
  type: "input",
  kind: "select",
  label: "Color",
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
};

export const name: AnyField = {
  id: "name",
  type: "input",
  kind: "text",
  label: "Name",
};

export const formulaSelect: SelectField = {
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  options: [],
  optionsFormula: { inputs: {}, formula: "[]" },
};

export const formulaMultiselect: MultiSelectField = {
  id: "tags",
  type: "input",
  kind: "multiselect",
  label: "Tags",
  options: [],
  optionsFormula: { inputs: {}, formula: "[]" },
};

export const staticMultiselect: MultiSelectField = {
  ...color,
  id: "colors",
  kind: "multiselect",
};

export const share: CustomComponentField = {
  id: "share",
  type: "input",
  kind: "custom",
  label: "Share",
  componentId: "share-url",
};

export const isRed: Extract<Condition, { kind: "equals" }> = {
  kind: "equals",
  when: "color",
  equals: "red",
};
export const named: Condition = {
  kind: "hasValue",
  when: "name",
  hasValue: true,
};

export const formulaOf = (text: string) => {
  const parsed = parseVisibilityFormula(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

let latestVisibility: VisibleIfFormula | undefined;

export const latest = () => latestVisibility;

function Editor({
  initial,
  previous = [color, name],
  later,
  outputBlocks,
}: {
  initial?: VisibleIfFormula;
  previous?: AnyField[];
  later?: AnyField[];
  outputBlocks?: OutputBlockOption[];
}) {
  const [visibleIfFormula, setVisibleIfFormula] = useState(initial);
  latestVisibility = visibleIfFormula;
  return (
    <ConditionalVisibility
      field={{ id: "self", visibleIfFormula }}
      previousFields={previous}
      laterFields={later}
      outputBlocks={outputBlocks}
      onChange={(updates) => setVisibleIfFormula(updates.visibleIfFormula)}
    />
  );
}

export const renderEditor = (
  props: Parameters<typeof Editor>[0] = {},
  drafts: CustomValidatorDraftsContextValue = {
    drafts: {},
    setDraft() {},
    removeDraft() {},
    createDraftId: () => -1,
  },
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CustomValidatorDraftsContext.Provider value={drafts}>
        <Editor {...props} />
      </CustomValidatorDraftsContext.Provider>
    </QueryClientProvider>,
  );

export const addRule = async (label: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
};

export const rule = (ruleName: string) =>
  within(screen.getByRole("listitem", { name: `Rule ${ruleName}` }));

export const expression = () =>
  screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Expression" });
