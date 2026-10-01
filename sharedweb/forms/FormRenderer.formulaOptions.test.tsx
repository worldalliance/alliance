import type {
  AnyField,
  FormSchema,
  MultiSelectField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import type { FormResponseDto, SubmitFormDto } from "@alliance/shared/client";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import {
  routes,
  serveApi,
  type RouteTable,
} from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

const serveHistory = (
  submissions: string[][],
  alsoServing: RouteTable = {},
) => {
  const requests: string[] = [];
  api.alsoServing({
    ...alsoServing,
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
  phDistinctId: null,
  deviceType: null,
  sessionReplayUrl: null,
  sid: null,
  visibilityValidatorResults: {},
  formulaChoices: {},
  ...saved,
});

const formTree = (
  schema: FormSchema,
  props: Partial<React.ComponentProps<typeof FormRenderer>> = {},
  client = new QueryClient(),
) => (
  <QueryClientProvider client={client}>
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
  </QueryClientProvider>
);

const renderForm = (
  schema: FormSchema,
  props: Partial<React.ComponentProps<typeof FormRenderer>> = {},
) => render(formTree(schema, props));

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

it("keeps a draft's selection while its options read a deleted form", async () => {
  api.alsoServing({
    "GET /tasks/responseHistory/:formId/user/:userId": () =>
      Response.json({ message: "Form not found" }, { status: 404 }),
  });
  window.localStorage.clear();
  renderForm(schemaOf([latestColors]), {
    persistKey: "k",
    draftFormResponse: savedResponse({ answers: { pick: "red" } }),
  });
  await screen.findByText(/has been deleted, so it can't be shown/);
  await act(async () => {});

  const drafts = Object.values({ ...window.localStorage }).map(
    (raw) => JSON.parse(raw).formData,
  );
  expect(drafts).toEqual([{ pick: "red" }]);
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

it("drops only the selections a changed answer no longer offers, and keeps them dropped", async () => {
  renderForm(schemaOf([localSource, fromLocal]));
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(boxes()[0]);
  fireEvent.click(boxes()[1]);
  fireEvent.click(boxes()[2]);
  fireEvent.click(boxes()[3]);

  fireEvent.click(boxes()[1]);
  expect(boxes().map((box) => box.checked)).toEqual([true, false, true]);

  fireEvent.click(boxes()[1]);
  expect(boxes().map((box) => box.checked)).toEqual([true, true, true, false]);
});

it("keeps a selection while the answer offering it is hidden", async () => {
  const toggle: AnyField = {
    id: "toggle",
    type: "input",
    kind: "radio",
    label: "Toggle",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  };
  renderForm(
    schemaOf([
      toggle,
      {
        ...localSource,
        visibleIfFormula: {
          conditions: {
            condition1: { kind: "equals", when: "toggle", equals: "yes" },
          },
          formula: "condition1",
        },
      },
      fromLocal,
    ]),
  );
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
  fireEvent.click(boxes()[0]);
  fireEvent.click(boxes()[2]);
  fireEvent.click(screen.getByRole("radio", { name: "No" }));
  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

  expect(boxes().map((box) => box.checked)).toEqual([true, false, true]);
});

it("offers a list sub-field's choices in every row, and drops the ones it stops offering", async () => {
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

  fireEvent.click(boxes()[1]);
  expect(rowSelects().map((select) => select.value)).toEqual(["a", ""]);
});

it("clears a restored draft's selections its options no longer offer", async () => {
  renderForm(schemaOf([localSource, fromLocal]), {
    draftFormResponse: savedResponse({
      answers: { source: ["a"], picked: ["a", "b"] },
    }),
  });

  const picked = screen.getAllByRole<HTMLInputElement>("checkbox").slice(2);
  expect(picked.map((box) => box.checked)).toEqual([true]);
});

it("keeps a restored draft's selections until sign-in loads", async () => {
  const draftFormResponse = savedResponse({
    answers: { source: ["a"], picked: ["a", "b"] },
  });
  const schema = schemaOf([localSource, fromLocal]);
  const client = new QueryClient();
  const { rerender } = render(
    formTree(schema, { draftFormResponse, userLoading: true }, client),
  );
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(boxes()[1]);
  rerender(formTree(schema, { draftFormResponse }, client));

  expect(boxes().map((box) => box.checked)).toEqual([true, true, true, true]);
});

describe("keeps a restored draft's selections once a visibility input fails", () => {
  const failing = {
    "the visibility context": {
      localSource: {
        ...localSource,
        visibleIfFormula: {
          conditions: { c1: { kind: "userHasCity", userHasCity: false } },
          formula: "c1",
        },
      },
      route: "GET /user/myvisibilitycontext",
    },
    "a validator": {
      localSource: {
        ...localSource,
        visibleIfFormula: {
          conditions: {
            c1: { kind: "validator", validatorId: 42, resultEquals: false },
          },
          formula: "c1",
        },
      },
      route: "POST /tasks/runValidator/:id",
    },
    "previous answers": {
      localSource: {
        ...localSource,
        visibleIfFormula: {
          conditions: {
            c1: {
              kind: "hasValue",
              when: "colors",
              hasValue: false,
              sourceFormId: SOURCE,
            },
          },
          formula: "c1",
        },
      },
      route: "GET /tasks/responses/:id",
    },
  } satisfies Record<string, { localSource: AnyField; route: string }>;

  it.each(Object.entries(failing))("%s", async (_, { localSource, route }) => {
    const original = console.error;
    console.error = () => {};
    let failed = false;
    serveHistory([], {
      "GET /tasks/slug/:id": () => Response.json({ schema: sourceSchema }),
      [route]: () => {
        failed = true;
        return Response.json({ message: "no" }, { status: 403 });
      },
    });
    try {
      renderForm(schemaOf([localSource, fromLocal]), {
        user: makeUser(),
        draftFormResponse: savedResponse({
          answers: { source: ["a"], picked: ["a", "b"] },
        }),
      });
      await waitFor(() => expect(failed).toBe(true));
      await act(async () => {});
      const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

      fireEvent.click(boxes()[1]);

      expect(boxes().map((box) => box.checked)).toEqual([
        true,
        true,
        true,
        true,
      ]);
    } finally {
      console.error = original;
    }
  });
});

it("drops a guest's stopped choice on a form with a validator condition", async () => {
  renderForm(
    schemaOf([
      {
        ...localSource,
        visibleIfFormula: {
          conditions: {
            c1: { kind: "validator", validatorId: 42, resultEquals: false },
          },
          formula: "c1",
        },
      },
      fromLocal,
    ]),
    {
      adminPreviewUserId: undefined,
      draftFormResponse: savedResponse({
        answers: { source: ["a"], picked: ["a", "b"] },
      }),
    },
  );
  await act(async () => {});
  const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");

  fireEvent.click(boxes()[1]);

  expect(boxes().map((box) => box.checked)).toEqual([true, true, true, false]);
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
