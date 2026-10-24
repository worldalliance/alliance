import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useInvalidateTaskFormAggregateViews,
  useTaskFormAggregateViews,
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
