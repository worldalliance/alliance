import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useInvalidateTaskForms, useTaskForm } from "./useTaskForm";

const form = { id: 7, title: "task", formSnapshotId: 1, schema: {} };
let status = 200;
let requests = 0;

serveApi(
  routes({
    "GET /tasks/slug/7": () => {
      requests += 1;
      return status === 200
        ? Response.json(form)
        : Response.json({ message: "Form is gone" }, { status });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requests = 0;
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

it("does not fetch without an id or while disabled", async () => {
  const { wrapper } = queryWrapper();

  const hooks = [
    renderHook(() => useTaskForm(undefined), { wrapper }),
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
