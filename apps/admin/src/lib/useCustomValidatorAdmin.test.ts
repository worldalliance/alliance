import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCustomValidatorAdmin } from "./useCustomValidatorAdmin";

afterEach(cleanup);

let requests: number[];
let respond: (id: number) => Response;

serveApi(
  routes({
    "GET /tasks/findOneCustomValidator/:id": ({ params }) => {
      const id = Number(params.id);
      requests.push(id);
      return respond(id);
    },
  }),
);

const saved = (id: number) =>
  Response.json({
    id,
    type: "HasPhoneNumber",
    idArgument: null,
    expression: null,
  });

beforeEach(() => {
  requests = [];
  respond = saved;
});

describe("useCustomValidatorAdmin", () => {
  it("reads a saved validator's settings", async () => {
    const view = renderHook(() => useCustomValidatorAdmin(7), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.query.data).toEqual({
        type: "HasPhoneNumber",
        idArgument: null,
        expression: null,
      }),
    );
  });

  it("fetches nothing for a null id", () => {
    const view = renderHook(
      () => useCustomValidatorAdmin(null),
      queryWrapper(),
    );

    expect(view.result.current.query.fetchStatus).toBe("idle");
    expect(requests).toEqual([]);
  });

  it("shares one load of a validator between readers", async () => {
    const { client, wrapper } = queryWrapper();
    const first = renderHook(() => useCustomValidatorAdmin(7), { wrapper });
    await waitFor(() =>
      expect(first.result.current.query.isSuccess).toBe(true),
    );

    const second = renderHook(() => useCustomValidatorAdmin(7), { wrapper });

    expect(second.result.current.query.isSuccess).toBe(true);
    expect(requests).toEqual([7]);
    expect(client.isFetching()).toBe(0);
  });

  it("surfaces a refused load at once, without retrying", async () => {
    respond = () => Response.json({ message: "Gone" }, { status: 500 });
    const view = renderHook(
      () => useCustomValidatorAdmin(7),
      queryWrapper({ retry: 3 }),
    );

    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(requests).toEqual([7]);
  });

  it("answers exists from a validator already loaded", async () => {
    const view = renderHook(() => useCustomValidatorAdmin(7), queryWrapper());
    await waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));

    expect(await view.result.current.exists(7)).toBe(true);
    expect(requests).toEqual([7]);
  });

  it("says a validator the server refuses does not exist", async () => {
    respond = () => Response.json({ message: "Not found" }, { status: 404 });
    const view = renderHook(
      () => useCustomValidatorAdmin(null),
      queryWrapper(),
    );

    expect(await view.result.current.exists(9)).toBe(false);
  });

  it("rejects exists when the server can't be reached", async () => {
    respond = () => {
      throw new TypeError("Failed to fetch");
    };
    const view = renderHook(
      () => useCustomValidatorAdmin(null),
      queryWrapper(),
    );

    await expect(view.result.current.exists(9)).rejects.toThrow(
      "Failed to fetch",
    );
  });
});
