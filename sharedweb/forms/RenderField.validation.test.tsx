import type { AnyField } from "@alliance/common/forms/form-schema";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { RenderField } from "./RenderField";
import { base, options, singleInputs } from "./RenderField.fixtures";

serveApi(routes({}));

const renderField = (field: AnyField, error?: string) =>
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={field}
          onChange={() => {}}
          error={error}
        />
      </SiteAppProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

// Each render below then shows the lazy inputs rather than their fallback.
beforeAll(async () => {
  renderField({ ...base, kind: "phone" });
  await screen.findByLabelText("Question");
  cleanup();
  renderField({ ...base, kind: "ranking", options });
  await screen.findByText("First choice");
  cleanup();
});

describe.each([
  ...singleInputs,
  { ...base, kind: "radio", options },
  { ...base, kind: "multiselect", options },
  { ...base, kind: "range", optionCount: 3 },
  { ...base, kind: "checkbox" },
  {
    ...base,
    kind: "contract",
    contractId: 1,
    contract: { id: 1, markdown: "Terms" },
    signQuestion: "Do you agree?",
    yesLabel: "Yes",
    noLabel: "No",
  },
  { ...base, kind: "list", fields: [{ ...base, id: "sub", kind: "text" }] },
  {
    ...base,
    kind: "select",
    options: [],
    optionsFormula: { inputs: {}, formula: "[]" },
  },
  { ...base, kind: "ranking", options },
  { ...base, kind: "custom", componentId: "example-contract" },
] satisfies AnyField[])("validation message for a $kind field", (field) => {
  const renderWithError = (error?: string) => renderField(field, error);

  it("shows the error", () => {
    renderWithError("Answer this question");
    expect(screen.getByText("Answer this question")).toBeTruthy();
  });

  it("shows nothing for a blank error", () => {
    const blank = renderWithError("  ").container;
    const none = renderWithError().container;
    expect(blank.querySelectorAll("*").length).toBe(
      none.querySelectorAll("*").length,
    );
    expect(blank.textContent).toBe(none.textContent);
  });
});
