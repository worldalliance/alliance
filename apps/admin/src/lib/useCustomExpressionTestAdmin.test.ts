import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCustomExpressionTestAdmin } from "./useCustomExpressionTestAdmin";

const results = {
  passCount: 1,
  failCount: 0,
  totalCount: 1,
  passUsers: [{ id: 7, name: "Ana", anonymous: false }],
  failUsers: [],
  selectedUserId: 7,
  selectedUserResult: true,
};

let respond: () => Response;
let bodies: unknown[];

serveApi(
  routes({
    "POST /tasks/testCustomExpression": async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    },
  }),
);

beforeEach(() => {
  respond = () => Response.json(results);
  bodies = [];
});

const input = { expression: "(user) => true", userId: 7 };

describe("useCustomExpressionTestAdmin", () => {
  it("runs the expression for the selected user only when run", async () => {
    const view = renderHook(
      () => useCustomExpressionTestAdmin(input),
      queryWrapper(),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bodies).toEqual([]);
    expect(view.result.current.query.data).toBeUndefined();

    await act(() => view.result.current.run());

    expect(bodies).toEqual([input]);
    await waitFor(() =>
      expect(view.result.current.query.data).toEqual(results),
    );
  });

  it("drops the result once the input changes", async () => {
    const view = renderHook((props) => useCustomExpressionTestAdmin(props), {
      ...queryWrapper(),
      initialProps: input,
    });
    expect(view.result.current.query.data).toBeUndefined();
    await act(() => view.result.current.run());
    await waitFor(() =>
      expect(view.result.current.query.data).toEqual(results),
    );

    view.rerender({ ...input, expression: "(user) => false" });
    expect(view.result.current.query.data).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));

    view.rerender(input);
    expect(view.result.current.query.data).toBeUndefined();
  });

  it("fails when the server leaves out the selected user's result", async () => {
    respond = () =>
      Response.json({ ...results, selectedUserResult: undefined });
    const view = renderHook(
      () => useCustomExpressionTestAdmin(input),
      queryWrapper(),
    );
    expect(view.result.current.query.error).toBeNull();

    await act(() => view.result.current.run());

    await waitFor(() =>
      expect(view.result.current.query.error?.message).toBe(
        "Missing selected user result.",
      ),
    );
  });

  it("sends one request when a run fails, despite the admin retry default", async () => {
    respond = () => Response.json({}, { status: 500 });
    const view = renderHook(
      () => useCustomExpressionTestAdmin(input),
      queryWrapper({ retry: retryUnlessRefused(3), retryDelay: 0 }),
    );

    await act(() => view.result.current.run());

    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(bodies).toHaveLength(1);
  });
});
