import { act, renderHook, waitFor } from "@testing-library/react";
import { makeUser } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMe } from "./useMe";

const user = makeUser();
let respond: () => Response | Promise<Response> = () =>
  Response.json({ user, isImpersonation: true });
let loads = 0;

serveApi(
  routes({
    "GET /auth/me": () => {
      loads += 1;
      return respond();
    },
  }),
);

beforeEach(() => {
  respond = () => Response.json({ user, isImpersonation: true });
  loads = 0;
});

const render = (queries?: Parameters<typeof queryWrapper>[0]) => {
  const { client, wrapper } = queryWrapper(queries);
  const view = renderHook(() => useMe(), { wrapper });
  return { client, view };
};

const loaded = async () => {
  const rendered = render();
  await act(() => rendered.view.result.current.fetch());
  await waitFor(() => expect(rendered.view.result.current.me).toBeDefined());
  return rendered;
};

describe("useMe", () => {
  it("shows the member a fetch loads", async () => {
    const { view } = render();
    expect(view.result.current.me).toBeUndefined();

    await act(() => view.result.current.fetch());

    await waitFor(() =>
      expect(view.result.current.me).toEqual({ user, isImpersonation: true }),
    );
  });

  it("does not fetch on its own", async () => {
    render();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(loads).toBe(0);
  });

  it("fetches again even while the cached member is fresh", async () => {
    const { view } = render({ staleTime: Infinity });
    await act(() => view.result.current.fetch());
    await act(() => view.result.current.fetch());
    expect(loads).toBe(2);
  });

  it("keeps the member when a later fetch fails", async () => {
    const { view } = await loaded();
    respond = () => Response.json({}, { status: 500 });

    await act(() => expect(view.result.current.fetch()).rejects.toBeDefined());

    expect(view.result.current.me?.user).toEqual(user);
  });

  it("keeps the member when /auth/me answers with an empty body", async () => {
    const { view } = await loaded();
    respond = () =>
      new Response(null, { status: 200, headers: { "Content-Length": "0" } });

    let failed = false;
    await act(() => view.result.current.fetch().catch(() => (failed = true)));

    expect(failed).toBe(true);
    expect(view.result.current.me?.user).toEqual(user);
  });

  it("shows the member a refresh loads", async () => {
    const { view } = await loaded();
    const renamed = { ...user, name: "Renamed" };
    respond = () => Response.json({ user: renamed });

    await act(() => view.result.current.refresh());

    await waitFor(() => expect(view.result.current.me?.user).toEqual(renamed));
  });

  it("logs a failed refresh and keeps the member", async () => {
    const { view } = await loaded();
    respond = () => Response.json({}, { status: 500 });
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    await act(() => view.result.current.refresh());

    expect(logged).toHaveBeenCalledWith(
      "failed to reload the signed-in member",
      expect.anything(),
    );
    expect(view.result.current.me?.user).toEqual(user);
    logged.mockRestore();
  });

  it("does not retry a failed fetch", async () => {
    const { view } = render({ retry: 3, retryDelay: 0 });
    respond = () => Response.json({}, { status: 503 });
    await act(() => expect(view.result.current.fetch()).rejects.toBeDefined());
    expect(loads).toBe(1);
  });

  it("replaces the member and keeps the rest of the session", async () => {
    const { view } = await loaded();
    const renamed = { ...user, name: "Renamed" };

    act(() => view.result.current.set(renamed));

    await waitFor(() =>
      expect(view.result.current.me).toEqual({
        user: renamed,
        isImpersonation: true,
      }),
    );
  });

  it("stores a member set with nothing cached", async () => {
    const { view } = render();
    act(() => view.result.current.set(user));
    await waitFor(() => expect(view.result.current.me).toEqual({ user }));
  });

  it("keeps showing the member while a new session's member loads", async () => {
    const { client, view } = await loaded();
    client.setQueryData(["other"], 1);
    const next = makeUser({ id: user.id + 1 });
    const held = Promise.withResolvers<void>();
    respond = () => held.promise.then(() => Response.json({ user: next }));

    let started!: Promise<unknown>;
    act(() => {
      started = view.result.current.startSession();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(client.getQueryData(["other"])).toBeUndefined();
    expect(view.result.current.me?.user).toEqual(user);
    held.resolve();
    await act(() => started);
    await waitFor(() => expect(view.result.current.me).toEqual({ user: next }));
  });

  it("keeps the member when a new session's member fails to load", async () => {
    const { view } = await loaded();
    respond = () => Response.json({}, { status: 500 });

    await act(() =>
      expect(view.result.current.startSession()).rejects.toBeDefined(),
    );

    expect(view.result.current.me?.user).toEqual(user);
  });

  it("starts a session with a load of its own rather than one in flight", async () => {
    const { view } = await loaded();
    const held = Promise.withResolvers<void>();
    const next = makeUser({ id: user.id + 1 });
    respond = () =>
      loads === 2
        ? held.promise.then(() => Response.json({ user }))
        : Response.json({ user: next });
    act(() => {
      void view.result.current.fetch();
    });

    let started!: Promise<unknown>;
    act(() => {
      started = view.result.current.startSession();
    });
    held.resolve();

    expect(await started).toEqual({ user: next });
  });

  it("empties the member it shows and every other query on clear", async () => {
    const { client, view } = await loaded();
    client.setQueryData(["other"], 1);

    act(() => view.result.current.clear());

    await waitFor(() => expect(view.result.current.me).toBeUndefined());
    expect(client.getQueryData(["other"])).toBeUndefined();
  });

  it("shows the next member set after a clear", async () => {
    const { view } = await loaded();
    const next = makeUser({ id: user.id + 1 });

    act(() => {
      view.result.current.clear();
      view.result.current.set(next);
    });

    await waitFor(() => expect(view.result.current.me).toEqual({ user: next }));
  });
});
