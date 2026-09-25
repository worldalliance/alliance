import type {
  AnyField,
  FormSchema,
  SelectField,
} from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

afterEach(cleanup);

serveApi(routes({}));

const SOURCE = 7;

const latestColors: SelectField = {
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  options: [],
  optionsFormula: {
    inputs: {
      input1: { kind: "sourceField", sourceFormId: SOURCE, fieldId: "colors" },
    },
    formula: "input1.at(-1) ?? []",
  },
};

const schemaOf = (fields: AnyField[]): FormSchema => ({
  pages: [{ id: "p1", fields }],
  outputViews: [],
});

const savedResponse = (
  saved: Pick<FormResponseDto, "answers"> &
    Partial<Pick<FormResponseDto, "formulaChoices">>,
): FormResponseDto => ({
  id: 1,
  formId: 1,
  formSnapshotId: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  publicAnswers: {},
  schemaSnapshot: {},
  visibilityValidatorResults: {},
  formulaChoices: {},
  ...saved,
});

const renderForm = (
  schema: FormSchema,
  props: Partial<React.ComponentProps<typeof FormRenderer>> = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={schema}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={null}
            adminPreviewUserId={3}
            {...props}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it("shows a completed response's saved choice", async () => {
  renderForm(schemaOf([latestColors]), {
    renderFormAsCompleted: true,
    completedFormResponse: savedResponse({
      answers: { pick: "gone" },
      formulaChoices: { pick: [{ label: "Saved label", value: "gone" }] },
    }),
  });

  expect(
    await screen.findByRole("option", { name: "Saved label", selected: true }),
  ).toBeTruthy();
});
