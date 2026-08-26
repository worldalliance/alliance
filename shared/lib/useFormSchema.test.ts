import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

let schemas: Record<number, unknown> = {};
let fetched: number[] = [];

jest.mock("../client", () => ({
  tasksGetForm: (options: { path: { id: number } }) => {
    const id = options.path.id;
    fetched.push(id);
    const schema = schemas[id];
    if (schema === undefined) return Promise.reject(new Error("no such form"));
    return Promise.resolve({
      data: { id, title: `Form ${id}`, formSnapshotId: id, schema },
    });
  },
}));

import { queryKeys } from "./queryKeys";
import {
  FormFieldsStatus,
  useFormQuestionFields,
  useFormQuestionFieldsMap,
  useFormQuestionFieldsPeek,
} from "./useFormSchema";

const schemaWith = (...labels: string[]) => ({
  pages: [
    {
      id: "page-1",
      fields: [
        { id: "banner", type: "display", kind: "text", text: "Hello" },
        ...labels.map((label, index) => ({
          id: `field-${index}`,
          type: "input",
          kind: "text",
          label,
        })),
      ],
    },
  ],
  outputViews: [],
});

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function mount<T>(hook: () => T) {
  const view = renderHook(hook, { wrapper: makeWrapper() });
  return { state: () => view.result.current };
}

beforeEach(() => {
  schemas = {};
  fetched = [];
});

afterEach(cleanup);

test("flattens a form's question fields and leaves display blocks out", async () => {
  schemas[4] = {
    pages: [
      { id: "one", fields: schemaWith("First").pages[0].fields },
      { id: "two", fields: schemaWith("Second").pages[0].fields },
    ],
    outputViews: [],
  };

  const { state } = mount(() => useFormQuestionFields(4));
  await waitFor(() => expect(state().status).toBe(FormFieldsStatus.Ready));

  expect(state().fields.map((field) => field.label)).toEqual([
    "First",
    "Second",
  ]);
});

test.each([undefined, 0])(
  "asks for nothing when no source form is selected (%p)",
  async (formId) => {
    const { state } = mount(() => useFormQuestionFields(formId));

    expect(state().status).toBe(FormFieldsStatus.Pending);
    expect(state().fields).toEqual([]);
    expect(fetched).toEqual([]);
  },
);

test("drops an element the schema no longer knows and keeps the rest", async () => {
  // What a display-block rename leaves behind on rows written before it. A
  // strict parse fails the whole form over one of these.
  schemas[9] = {
    pages: [
      {
        id: "page-1",
        fields: [
          { id: "legacy", type: "display", kind: "image", url: "old.png" },
          { id: "kept", type: "input", kind: "text", label: "Kept" },
        ],
      },
    ],
    outputViews: [],
  };

  const { state } = mount(() => useFormQuestionFields(9));
  await waitFor(() => expect(state().status).toBe(FormFieldsStatus.Ready));

  expect(state().fields.map((field) => field.label)).toEqual(["Kept"]);
});

test("tells a schema too malformed to read from a form that is gone", async () => {
  schemas[10] = { pages: "not an array" };

  const unreadable = mount(() => useFormQuestionFields(10));
  await waitFor(() =>
    expect(unreadable.state().status).toBe(FormFieldsStatus.SchemaUnreadable),
  );
  expect(unreadable.state().fields).toEqual([]);

  // The picker tells the admin to go looking for a deleted form only when the
  // form itself failed to load.
  const missing = mount(() => useFormQuestionFields(404));
  await waitFor(() =>
    expect(missing.state().status).toBe(FormFieldsStatus.LoadFailed),
  );
});

test("keys many forms by id rather than by request order", async () => {
  schemas[1] = schemaWith("One");
  schemas[2] = schemaWith("Two");

  const { state } = mount(() => useFormQuestionFieldsMap([2, 1]));
  await waitFor(() =>
    expect(state().statusByForm[1]).toBe(FormFieldsStatus.Ready),
  );
  await waitFor(() =>
    expect(state().statusByForm[2]).toBe(FormFieldsStatus.Ready),
  );

  expect(state().byForm[1].map((field) => field.label)).toEqual(["One"]);
  expect(state().byForm[2].map((field) => field.label)).toEqual(["Two"]);
});

test("blames the form that failed and not the ones beside it", async () => {
  schemas[11] = schemaWith("Fine");

  const { state } = mount(() => useFormQuestionFieldsMap([11, 404]));
  await waitFor(() =>
    expect(state().statusByForm[404]).toBe(FormFieldsStatus.LoadFailed),
  );

  // Two cross-form conditions, one dead source form: the live one must not
  // render the "could not load" line meant for its neighbour.
  expect(state().statusByForm[11]).toBe(FormFieldsStatus.Ready);
  expect(state().byForm[11].map((field) => field.label)).toEqual(["Fine"]);
});

test("skips the sentinel id a picker sits on before a form is chosen", async () => {
  schemas[6] = schemaWith("Real");

  const { state } = mount(() => useFormQuestionFieldsMap([0, 6]));
  await waitFor(() =>
    expect(state().statusByForm[6]).toBe(FormFieldsStatus.Ready),
  );

  expect(fetched).toEqual([6]);
  expect(state().statusByForm[0]).toBeUndefined();
});

test("reports the form it could not load instead of an empty field list", async () => {
  // Every retry is another 404 for a condition pointing at a deleted form.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3 } } });
  const view = renderHook(() => useFormQuestionFields(404), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });

  await waitFor(() =>
    expect(view.result.current.status).toBe(FormFieldsStatus.LoadFailed),
  );

  expect(fetched).toEqual([404]);
  expect(view.result.current.fields).toEqual([]);
});

test("peeks what a picker already fetched, and never fetches itself", async () => {
  schemas[3] = schemaWith("Only");
  const wrapper = makeWrapper();

  const peek = renderHook(() => useFormQuestionFieldsPeek(), { wrapper });
  expect(peek.result.current(3)).toBeUndefined();
  expect(fetched).toEqual([]);

  const picker = renderHook(() => useFormQuestionFields(3), { wrapper });
  await waitFor(() =>
    expect(picker.result.current.status).toBe(FormFieldsStatus.Ready),
  );

  expect(peek.result.current(3)?.map((field) => field.label)).toEqual(["Only"]);
  expect(fetched).toEqual([3]);
});

test("shares one request between the pickers that want the same form", async () => {
  schemas[5] = schemaWith("Shared");
  const wrapper = makeWrapper();

  const view = renderHook(() => useFormQuestionFields(5), { wrapper });
  renderHook(() => useFormQuestionFields(5), { wrapper });
  await waitFor(() =>
    expect(view.result.current.status).toBe(FormFieldsStatus.Ready),
  );

  expect(fetched).toEqual([5]);
});

test("serves a remounted picker from cache instead of refetching", async () => {
  schemas[8] = schemaWith("Cached");
  const wrapper = makeWrapper();

  const first = renderHook(() => useFormQuestionFields(8), { wrapper });
  await waitFor(() =>
    expect(first.result.current.status).toBe(FormFieldsStatus.Ready),
  );
  first.unmount();

  // Clicking between fields in the builder mounts a fresh picker each time.
  const second = renderHook(() => useFormQuestionFields(8), { wrapper });
  await waitFor(() =>
    expect(second.result.current.fields.map((f) => f.label)).toEqual([
      "Cached",
    ]),
  );

  expect(fetched).toEqual([8]);
});

test("keeps the fields it has when a refetch fails", async () => {
  schemas[12] = schemaWith("Still here");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  const view = renderHook(() => useFormQuestionFields(12), { wrapper });
  await waitFor(() =>
    expect(view.result.current.status).toBe(FormFieldsStatus.Ready),
  );

  // Tabbing back into the builder refetches, and the request fails.
  delete schemas[12];
  await client.refetchQueries({
    queryKey: queryKeys.formQuestionFieldsAdmin(12),
  });

  // "It may have been deleted" beside a full field list would be a lie about
  // a form that is fine.
  expect(view.result.current.status).toBe(FormFieldsStatus.Ready);
  expect(view.result.current.fields.map((f) => f.label)).toEqual([
    "Still here",
  ]);
});
