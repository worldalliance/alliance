import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { FormResponseCounts } from "./useFormsAdmin";

type CountRow = { formId: number; count: number };

type FormRow = {
  id: number;
  title: string;
  formSnapshotId: number;
  schemaCounts: { pages: number; fields: number };
};

let batches: number[][] = [];
let respond: (formIds: number[]) => Promise<{ data: CountRow[] }>;
let listCalls = 0;
let listed: FormRow[] = [];

jest.mock("../client", () => ({
  tasksGetFormResponseCountsAdmin: (options: {
    body: { formIds: number[] };
  }) => {
    batches.push(options.body.formIds);
    return respond(options.body.formIds);
  },
  tasksListFormsAdmin: () => {
    listCalls++;
    return Promise.resolve({ data: listed });
  },
  tasksDeleteFormAdmin: () => Promise.resolve({ data: undefined }),
}));

import { queryKeys } from "./queryKeys";
import {
  ResponseCountStatus,
  useFormResponseCountsAdmin,
  useFormsAdmin,
  useInvalidateFormsAdmin,
  useInvalidateFormsIndex,
} from "./useFormsAdmin";

const formRow = (id: number, title: string): FormRow => ({
  id,
  title,
  formSnapshotId: id,
  schemaCounts: { pages: 0, fields: 0 },
});

const respondWith = (counted: Map<number, number>) => (formIds: number[]) =>
  Promise.resolve({
    data: formIds.map((formId) => ({
      formId,
      count: counted.get(formId) ?? 0,
    })),
  });

function mountCounts(formIds: number[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = renderHook(() => useFormResponseCountsAdmin(formIds), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });
  return { state: () => view.result.current, client };
}

beforeEach(() => {
  batches = [];
  respond = respondWith(new Map());
  listCalls = 0;
  listed = [];
});

afterEach(cleanup);

const settled = (state: () => FormResponseCounts, formId: number) => () =>
  expect(state().statusByForm[formId]).not.toBe(ResponseCountStatus.Pending);

test("splits ids into batches the endpoint accepts, in a stable order", async () => {
  respond = respondWith(
    new Map([
      [7, 3],
      [140, 11],
    ]),
  );

  const shuffled = Array.from({ length: 150 }, (_, i) => i + 1).reverse();
  const { state } = mountCounts(shuffled);
  await waitFor(settled(state, 7));
  await waitFor(settled(state, 140));

  expect(batches.map((batch) => batch.length)).toEqual([100, 50]);
  expect(batches[0][0]).toBe(1);
  expect(batches[1][49]).toBe(150);
  expect(state().byForm[7]).toBe(3);
  expect(state().byForm[140]).toBe(11);
});

test("merges the rows of every batch into one lookup", async () => {
  respond = respondWith(new Map([[2, 5]]));

  const { state } = mountCounts([1, 2, 3]);
  await waitFor(settled(state, 1));

  expect(state().byForm).toEqual({ 1: 0, 2: 5, 3: 0 });
  expect(state().statusByForm).toEqual({
    1: ResponseCountStatus.Ready,
    2: ResponseCountStatus.Ready,
    3: ResponseCountStatus.Ready,
  });
});

test("keeps counts unknown rather than zero while a batch is in flight", async () => {
  let release!: (rows: CountRow[]) => void;
  respond = () =>
    new Promise((resolve) => {
      release = (rows) => resolve({ data: rows });
    });

  const { state } = mountCounts([1, 2]);
  await waitFor(() => expect(batches.length).toBe(1));
  expect(state().statusByForm[1]).toBe(ResponseCountStatus.Pending);
  expect(state().byForm[1]).toBeUndefined();

  release([
    { formId: 1, count: 4 },
    { formId: 2, count: 0 },
  ]);
  await waitFor(settled(state, 1));
  expect(state().byForm).toEqual({ 1: 4, 2: 0 });
});

test("reports an error instead of zeroes when the request fails", async () => {
  respond = () => Promise.reject(new Error("boom"));

  const { state } = mountCounts([1, 2]);
  await waitFor(settled(state, 1));

  expect(state().byForm).toEqual({});
  expect(state().statusByForm).toEqual({
    1: ResponseCountStatus.Error,
    2: ResponseCountStatus.Error,
  });
});

test("blames the batch that failed and not the one still in flight", async () => {
  // 150 forms is two batches. The first fails, the second never settles: the
  // forms in the first must stop reading as "counting" regardless.
  respond = (formIds) =>
    formIds[0] === 1
      ? Promise.reject(new Error("boom"))
      : new Promise(() => {});

  const { state } = mountCounts(Array.from({ length: 150 }, (_, i) => i + 1));
  await waitFor(settled(state, 1));

  expect(state().statusByForm[1]).toBe(ResponseCountStatus.Error);
  expect(state().statusByForm[150]).toBe(ResponseCountStatus.Pending);
});

test("makes no request when there are no forms", async () => {
  const { state } = mountCounts([]);

  expect(batches).toEqual([]);
  expect(state().byForm).toEqual({});
  expect(state().statusByForm).toEqual({});
});

test("serves the cached list within its stale time", async () => {
  listed = [formRow(1, "Before")];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  const view = renderHook(() => useFormsAdmin(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(listCalls).toBe(1);

  listed = [formRow(1, "After")];
  renderHook(() => useFormsAdmin(), { wrapper });
  expect(listCalls).toBe(1);
  expect(view.result.current.forms[0].title).toBe("Before");
});

test("invalidating refetches the list a picker is already showing", async () => {
  listed = [formRow(1, "Before")];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  const view = renderHook(
    () => ({ ...useFormsAdmin(), invalidate: useInvalidateFormsAdmin() }),
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(listCalls).toBe(1);

  // FormBuilder saves on every Cmd-S while a form picker holds this query
  // open, and the picker has to pick up the new title.
  listed = [formRow(1, "After")];
  await view.result.current.invalidate();

  await waitFor(() => expect(view.result.current.forms[0].title).toBe("After"));
  expect(listCalls).toBe(2);
});

test("deleting a form refetches the list it was deleted from", async () => {
  listed = [formRow(1, "Doomed"), formRow(2, "Kept")];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = renderHook(() => useFormsAdmin(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });
  await waitFor(() => expect(view.result.current.forms).toHaveLength(2));

  listed = [formRow(2, "Kept")];
  await view.result.current.deleteForm(1);
  await waitFor(() => expect(view.result.current.forms).toHaveLength(1));
  expect(view.result.current.forms[0].title).toBe("Kept");
});

test("gives back the same empty array while the list is loading", async () => {
  const { result, rerender } = renderHook(() => useFormsAdmin(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        {
          client: new QueryClient({
            defaultOptions: { queries: { retry: false } },
          }),
        },
        children,
      ),
  });
  const first = result.current.forms;
  rerender();
  expect(result.current.forms).toBe(first);
});

test("an action write leaves the cached field lists a builder is holding open", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const fieldsKey = queryKeys.formQuestionFieldsAdmin(1);
  client.setQueryData(fieldsKey, { formId: 1, fields: [] });

  const view = renderHook(
    () => ({
      index: useInvalidateFormsIndex(),
      everything: useInvalidateFormsAdmin(),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    },
  );

  // Renaming an action only moves usedInAction on the index.
  await view.result.current.index();
  expect(client.getQueryState(fieldsKey)?.isInvalidated).toBe(false);

  // Saving the form itself does move its fields.
  await view.result.current.everything();
  expect(client.getQueryState(fieldsKey)?.isInvalidated).toBe(true);
});

test("serves cached counts within their stale time", async () => {
  respond = respondWith(new Map([[1, 2]]));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  const first = renderHook(() => useFormResponseCountsAdmin([1]), { wrapper });
  await waitFor(() =>
    expect(first.result.current.statusByForm[1]).toBe(
      ResponseCountStatus.Ready,
    ),
  );
  first.unmount();

  // FormsList remounts on every trip out to a form's responses and back.
  const second = renderHook(() => useFormResponseCountsAdmin([1]), { wrapper });
  await waitFor(() => expect(second.result.current.byForm[1]).toBe(2));
  expect(batches.length).toBe(1);
});
