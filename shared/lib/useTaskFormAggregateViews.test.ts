import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useInvalidateTaskFormAggregateViews,
  useTaskFormAggregateViews,
  useTaskFormsAggregateViews,
} from "./useTaskFormAggregateViews";

const bar = (id: string, value: number) => ({
  kind: "progressbar",
  id,
  numerator: { type: "number", value },
  denominator: { type: "number", value: 10 },
  displayType: "number",
});

let requested: string[] = [];
let respond: (formId: string) => Response;

serveApi(
  routes({
    "GET /tasks/aggregateViews/:id": ({ params }) => {
      requested.push(params.id);
      return respond(params.id);
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = (formId) =>
    Response.json({ aggregateViews: [bar(`bar-${formId}`, 1)] });
});

it("loads a form's views, dropping entries it cannot read", async () => {
  respond = () =>
    Response.json({ aggregateViews: [bar("kept", 1), { kind: "unknown" }] });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskFormAggregateViews(7), { wrapper });

  await waitFor(() =>
    expect(hook.result.current.map((view) => view.id)).toEqual(["kept"]),
  );
});

it("requests nothing for an action without a form", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskFormAggregateViews(undefined), {
    wrapper,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(hook.result.current).toEqual([]);
  expect(requested).toEqual([]);
});

it("reads a failed load as no views", async () => {
  respond = () => Response.json({ message: "Unauthorized" }, { status: 401 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskFormAggregateViews(7), { wrapper });

  await waitFor(() => expect(requested).toEqual(["7"]));
  expect(hook.result.current).toEqual([]);
});

it("refetches a form's views once a write invalidates them", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => ({
      views: useTaskFormAggregateViews(7),
      invalidate: useInvalidateTaskFormAggregateViews(),
    }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.views).toHaveLength(1));

  respond = () => Response.json({ aggregateViews: [bar("bar-7", 5)] });
  act(() => hook.result.current.invalidate(7));

  await waitFor(() =>
    expect(hook.result.current.views[0]?.numerator.value).toBe(5),
  );
});

it("loads each form once and keys the views by form", async () => {
  respond = (formId) =>
    formId === "8"
      ? Response.json({ message: "Not found" }, { status: 404 })
      : Response.json({ aggregateViews: [bar(`bar-${formId}`, 1)] });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useTaskFormsAggregateViews([7, 8, 7]), {
    wrapper,
  });

  await waitFor(() => expect(Object.keys(hook.result.current)).toEqual(["7"]));
  expect(hook.result.current[7]?.map((view) => view.id)).toEqual(["bar-7"]);
  await waitFor(() => expect(requested.sort()).toEqual(["7", "8"]));
});

it("shares one cache entry between a form's readers", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => ({
      one: useTaskFormAggregateViews(7),
      many: useTaskFormsAggregateViews([7]),
    }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.many[7]).toHaveLength(1));
  expect(hook.result.current.one).toEqual(hook.result.current.many[7] ?? []);
  expect(requested).toEqual(["7"]);
});
