import type {
  AnyField,
  FormSchema,
  SelectField,
} from "@alliance/common/forms/form-schema";
import type { FormResponseDto, SubmitFormDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

afterEach(cleanup);

const api = serveApi(routes({}));

const SOURCE = 7;

const sourceSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "colors",
          type: "input",
          kind: "multiselect",
          label: "Colors",
          options: [
            { label: "Red", value: "red" },
            { label: "Blue", value: "blue" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const serveHistory = (submissions: string[][]) => {
  const requests: string[] = [];
  api.alsoServing({
    "GET /tasks/responseHistory/:formId/user/:userId": ({ params }) => {
      requests.push(params.formId);
      return Response.json({
        schema: sourceSchema,
        responses: submissions.map((colors, index) => ({
          id: 100 + index,
          answers: { colors },
          schemaSnapshot: sourceSchema,
          formulaChoices: {},
        })),
      });
    },
  });
  return requests;
};

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

it("submits the responses its options read", async () => {
  serveHistory([["red"], ["blue"]]);
  const onSubmit = jest.fn(async (_data: SubmitFormDto) => false);
  renderForm(schemaOf([latestColors]), { onSubmit });

  await screen.findByRole("combobox", { name: "Pick" });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
  });

  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    formulaSources: [{ formId: SOURCE, responseIds: [100, 101] }],
  });
});

it("names the responses its options read when withdrawing", async () => {
  serveHistory([["red"]]);
  const onAbandonAction = jest.fn();
  const { container } = renderForm(schemaOf([latestColors]), {
    onAbandonAction,
  });

  await screen.findByRole("combobox", { name: "Pick" });
  const menu = container.querySelector(".lucide-ellipsis")?.closest("button");
  if (!menu) throw new Error("no withdrawal menu");
  fireEvent.click(menu);
  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

  expect(onAbandonAction.mock.calls[0][0].partialFormData).toMatchObject({
    formulaSources: [{ formId: SOURCE, responseIds: [100] }],
  });
});

it("shows a completed response's saved choice without loading the history", async () => {
  const requests = serveHistory([["red"]]);
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
  expect(requests).toEqual([]);
});
