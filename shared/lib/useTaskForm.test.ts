import { R } from "@alliance/common/result";
import { renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { retryUnlessRefused } from "./retryQuery";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  FormUpdateFailure,
  useAdminTaskForm,
  useAdminTaskFormActions,
  useInvalidateTaskForms,
  useTaskForm,
} from "./useTaskForm";

const form = { id: 7, title: "task", formSnapshotId: 1, schema: {} };
let status = 200;
let requests = 0;
let stored = { ...form, title: "stored" };
let storedStatus = 200;
let storedRequests = 0;
let heldResponse: Promise<void> | null = null;
let updateStatus = 200;
let updateUnreachable = false;

serveApi(
  routes({
    "GET /tasks/slug/7": () => {
      requests += 1;
      return status === 200
        ? Response.json(form)
        : Response.json({ message: "Form is gone" }, { status });
    },
    "GET /tasks/adminForm/7": async () => {
      storedRequests += 1;
      const served = stored;
      const held = heldResponse;
      heldResponse = null;
      await held;
      return Response.json(served, { status: storedStatus });
    },
    "PUT /tasks/updateForm/7": () => {
      if (updateUnreachable) throw new TypeError("Failed to fetch");
      return updateStatus === 200
        ? Response.json({ ...stored, formSnapshotId: 2 })
        : Response.json({ message: "Changed" }, { status: updateStatus });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requests = 0;
  stored = { ...form, title: "stored" };
  storedStatus = 200;
  storedRequests = 0;
  heldResponse = null;
  updateStatus = 200;
  updateUnreachable = false;
});

it("loads the form with the given id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskForm(7), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual(form);
});

it("fails with the server's message", async () => {
  status = 404;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskForm(7), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error?.message).toBe("Form is gone");
});

it("does not retry a refused load", async () => {
  status = 404;
  const { wrapper } = queryWrapper({
    retry: retryUnlessRefused(3),
    retryDelay: 0,
  });

  const hook = renderHook(() => useTaskForm(7), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(requests).toBe(1);
});

it("does not fetch without an id or while disabled", async () => {
  const { wrapper } = queryWrapper();

  const hooks = [
    renderHook(() => useTaskForm(undefined), { wrapper }),
    renderHook(() => useTaskForm(null), { wrapper }),
    renderHook(() => useTaskForm(7, { enabled: false }), { wrapper }),
  ];

  await new Promise((resolve) => setTimeout(resolve, 20));
  for (const hook of hooks) expect(hook.result.current.data).toBeUndefined();
  expect(requests).toBe(0);
});

it("refetches a loaded form once invalidated", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => ({ form: useTaskForm(7), invalidate: useInvalidateTaskForms() }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.form.isSuccess).toBe(true));

  await hook.result.current.invalidate();

  expect(requests).toBe(2);
});

const adminActions = (queries?: Parameters<typeof queryWrapper>[0]) => {
  const query = queryWrapper(queries);
  const hook = renderHook(() => useAdminTaskFormActions(), {
    wrapper: query.wrapper,
  });
  return { client: query.client, actions: () => hook.result.current };
};

it("fetches the stored form over a cached copy, and caches what it got", async () => {
  const { client, actions } = adminActions({ staleTime: Infinity });
  client.setQueryData(queryKeys.taskFormAdmin(7), { ...form, title: "old" });

  const fetched = await actions().fetchLatest(7);

  expect(fetched).toEqual(R.success(stored));
  expect(client.getQueryData(queryKeys.taskFormAdmin(7))).toEqual(stored);
});

it("caches the saved form and invalidates the forms derived from it", async () => {
  const { client, actions } = adminActions();
  client.setQueryData(queryKeys.formsAdmin(), []);

  const result = await actions().updateForm({
    formId: 7,
    body: { schema: {} },
  });

  expect(R.isSuccess(result)).toBe(true);
  expect(client.getQueryData(queryKeys.taskFormAdmin(7))).toMatchObject({
    formSnapshotId: 2,
  });
  expect(client.getQueryState(queryKeys.formsAdmin())?.isInvalidated).toBe(
    true,
  );
});

it("tells a conflicting save from a failed one, caching neither", async () => {
  const { client, actions } = adminActions();
  client.setQueryData(queryKeys.formsAdmin(), []);
  const save = () => actions().updateForm({ formId: 7, body: { schema: {} } });

  updateStatus = 409;
  expect(await save()).toEqual(R.failure(FormUpdateFailure.Conflict));
  updateStatus = 400;
  expect(await save()).toEqual(R.failure(FormUpdateFailure.Failed));

  expect(client.getQueryData(queryKeys.taskFormAdmin(7))).toBeUndefined();
  expect(client.getQueryState(queryKeys.formsAdmin())?.isInvalidated).toBe(
    false,
  );
});

it("fails a fetch of the stored form at once, without the app's retries", async () => {
  storedStatus = 503;
  const { actions } = adminActions({
    retry: retryUnlessRefused(3),
    retryDelay: 0,
  });

  expect((await actions().fetchLatest(7)).ok).toBe(false);
  expect(storedRequests).toBe(1);
});

it("reads afresh, without retries, over a screen's fetch in flight", async () => {
  storedStatus = 503;
  const query = queryWrapper({
    retry: retryUnlessRefused(3),
    retryDelay: 1000,
  });
  const hook = renderHook(
    () => {
      useAdminTaskForm(7);
      return useAdminTaskFormActions();
    },
    { wrapper: query.wrapper },
  );
  await waitFor(() => expect(storedRequests).toBe(1));

  expect((await hook.result.current.fetchLatest(7)).ok).toBe(false);

  expect(storedRequests).toBe(2);
});

it("gives each overlapping fetch its own read", async () => {
  const { actions } = adminActions();

  const both = await Promise.all([
    actions().fetchLatest(7),
    actions().fetchLatest(7),
  ]);

  expect(both).toEqual([R.success(stored), R.success(stored)]);
  expect(storedRequests).toBe(2);
});

it("leaves its read in the cache over a screen's older fetch landing later", async () => {
  let release = () => {};
  heldResponse = new Promise((resolve) => (release = resolve));
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      title: useAdminTaskForm(7).data?.title,
      actions: useAdminTaskFormActions(),
    }),
    { wrapper: query.wrapper },
  );
  await waitFor(() => expect(storedRequests).toBe(1));

  stored = { ...stored, title: "fresh" };
  await hook.result.current.actions.fetchLatest(7);
  release();

  await waitFor(() => expect(hook.result.current.title).toBe("fresh"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.title).toBe("fresh");
});

it("fails a save that never reached the server", async () => {
  updateUnreachable = true;
  const { client, actions } = adminActions();

  const result = await actions().updateForm({
    formId: 7,
    body: { schema: {} },
  });

  expect(result).toEqual(R.failure(FormUpdateFailure.Failed));
  expect(client.getQueryData(queryKeys.taskFormAdmin(7))).toBeUndefined();
});
