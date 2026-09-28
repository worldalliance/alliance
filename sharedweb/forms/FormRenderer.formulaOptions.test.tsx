import type {
  AnyField,
  FormSchema,
  MultiSelectField,
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

const fromLocal: MultiSelectField = {
  id: "picked",
  type: "input",
  kind: "multiselect",
  label: "Picked",
  options: [],
  optionsFormula: {
    inputs: { input1: { kind: "field", fieldId: "source" } },
    formula: "input1 ?? []",
  },
};

const localSource: MultiSelectField = {
  id: "source",
  type: "input",
  kind: "multiselect",
  label: "Source",
  options: [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ],
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

it("offers the latest submission's choices once the member's history loads", async () => {
  serveHistory([["red"], ["blue", "red"]]);
  renderForm(schemaOf([latestColors]));

  await screen.findByRole("option", { name: "Blue" });
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["Select an option", "Blue", "Red"]);
});

it("waits for sign-in to resolve instead of offering a guest's choices", () => {
  renderForm(schemaOf([latestColors]), {
    adminPreviewUserId: undefined,
    userLoading: true,
  });

  expect(screen.queryByRole("combobox", { name: "Pick" })).toBeNull();
  expect(screen.queryByText("No options available")).toBeNull();
});

it("disables a field whose formula offers nothing", async () => {
  serveHistory([]);
  renderForm(schemaOf([latestColors]));

  const empty = await screen.findByRole<HTMLSelectElement>("combobox", {
    name: "Pick",
  });
  expect(empty.disabled).toBe(true);
  expect(screen.getByText("No options available")).toBeTruthy();
});

it("won't draw a form whose options formula fails", () => {
  renderForm(
    schemaOf([
      {
        ...fromLocal,
        optionsFormula: { inputs: {}, formula: "'not a list'" },
      },
    ]),
  );

  expect(screen.getByText("This form can't be displayed")).toBeTruthy();
  expect(screen.queryByText("Picked")).toBeNull();
});

it("draws a read-only form whose options read a deleted form", async () => {
  api.alsoServing({
    "GET /tasks/responseHistory/:formId/user/:userId": () =>
      Response.json({ message: "Form not found" }, { status: 404 }),
  });
  renderForm(schemaOf([latestColors]), { renderFormAsCompleted: true });

  expect(await screen.findByRole("combobox", { name: "Pick" })).toBeTruthy();
  expect(screen.queryByText("This form can't be displayed")).toBeNull();
});

it("keeps a required field offered nothing required", async () => {
  const onSubmit = jest.fn(async (_data: SubmitFormDto) => true);
  renderForm(schemaOf([{ ...fromLocal, required: true }]), { onSubmit });

  expect(screen.getByText("No options available")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
  });

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("Select at least one option.")).toBeTruthy();
  const field = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Picked",
  });
  expect(field.required).toBe(true);
  expect(field.getAttribute("aria-invalid")).toBe("true");
});

it("leaves out the selection limit when a multiselect is offered nothing", () => {
  renderForm(schemaOf([{ ...fromLocal, maxSelections: 2 }]));

  expect(screen.getByText("No options available")).toBeTruthy();
  expect(screen.queryByText(/Select up to/)).toBeNull();
});

it("offers a list sub-field's choices in every row", async () => {
  renderForm(
    schemaOf([
      localSource,
      {
        id: "rows",
        type: "input",
        kind: "list",
        label: "Rows",
        defaultNumber: 2,
        fields: [{ ...fromLocal, kind: "select", options: [] }],
      },
    ]),
  );
  const rowSelects = () =>
    screen.getAllByRole<HTMLSelectElement>("combobox", { name: "Picked" });
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(boxes()[0]);
  fireEvent.click(boxes()[1]);
  fireEvent.change(rowSelects()[0], { target: { value: "a" } });
  fireEvent.change(rowSelects()[1], { target: { value: "b" } });
  expect(
    Array.from(rowSelects()[1].options).map((option) => option.textContent),
  ).toEqual(["Select an option", "A", "B"]);
});

it("submits without a selection its formula stopped offering", async () => {
  const onSubmit = jest.fn(async (_data: SubmitFormDto) => false);
  renderForm(schemaOf([localSource, fromLocal]), { onSubmit });
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(boxes()[0]);
  fireEvent.click(boxes()[1]);
  fireEvent.click(boxes()[3]);
  fireEvent.click(boxes()[1]);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
  });

  expect(onSubmit.mock.calls[0][0].answers).toEqual({ source: ["a"] });
});

it("submits the responses its options read", async () => {
  serveHistory([["red"], ["blue"]]);
  const onSubmit = jest.fn(async (_data: SubmitFormDto) => false);
  renderForm(schemaOf([latestColors]), { onSubmit });

  const select = await screen.findByRole("combobox", { name: "Pick" });
  await screen.findByRole("option", { name: "Blue" });
  fireEvent.change(select, { target: { value: "blue" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
  });

  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    answers: { pick: "blue" },
    formulaSources: [{ formId: SOURCE, responseIds: [100, 101] }],
  });
});

it("names the responses its options read when withdrawing", async () => {
  serveHistory([["red"]]);
  const onAbandonAction = jest.fn();
  const { container } = renderForm(schemaOf([latestColors]), {
    onAbandonAction,
  });

  await screen.findByRole("option", { name: "Red" });
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
