import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { UpdateProfileDto } from "../client";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { deviceTimeZone } from "./timeZone";
import { useBackfillTimeZone } from "./useBackfillTimeZone";

let payloads: UpdateProfileDto[] = [];
let refused = false;

serveApi(
  routes({
    "POST /user/update": async ({ request }) => {
      payloads.push((await request.json()) as UpdateProfileDto);
      return refused
        ? Response.json({ message: "offline" }, { status: 500 })
        : Response.json({ id: 7 });
    },
  }),
);

beforeEach(() => {
  payloads = [];
  refused = false;
});

afterEach(cleanup);

const settle = () => act(async () => {});

describe("useBackfillTimeZone", () => {
  it("sends the device zone for a member who has none", async () => {
    renderHook(() => useBackfillTimeZone({ id: 7 }), {
      wrapper: queryWrapper().wrapper,
    });

    await waitFor(() =>
      expect(payloads).toEqual([{ timeZone: deviceTimeZone() }]),
    );
  });

  it("leaves a member who already has one alone", async () => {
    renderHook(
      () => useBackfillTimeZone({ id: 7, timeZone: "Europe/Berlin" }),
      {
        wrapper: queryWrapper().wrapper,
      },
    );

    await settle();
    expect(payloads).toEqual([]);
  });

  it("does nothing before the user loads", async () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: undefined as { id: number } | undefined },
      wrapper: queryWrapper().wrapper,
    });
    await settle();
    expect(payloads).toEqual([]);

    view.rerender({ user: { id: 7 } });
    await waitFor(() => expect(payloads).toHaveLength(1));
  });

  it("sends once, however often the user object is replaced", async () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: { id: 7 } },
      wrapper: queryWrapper().wrapper,
    });
    view.rerender({ user: { id: 7 } });
    view.rerender({ user: { id: 7 } });

    await settle();
    expect(payloads).toHaveLength(1);
  });

  it("sends again for a different member on the same mount", async () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: { id: 7 } },
      wrapper: queryWrapper().wrapper,
    });
    view.rerender({ user: { id: 8 } });

    await waitFor(() => expect(payloads).toHaveLength(2));
  });

  it("writes nothing while disabled, and sends once enabled", async () => {
    const view = renderHook(
      ({ enabled }) => useBackfillTimeZone({ id: 7 }, { enabled }),
      { initialProps: { enabled: false }, wrapper: queryWrapper().wrapper },
    );
    await settle();
    expect(payloads).toEqual([]);

    view.rerender({ enabled: true });
    await waitFor(() =>
      expect(payloads).toEqual([{ timeZone: deviceTimeZone() }]),
    );
  });

  it("logs a failed write", async () => {
    refused = true;
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useBackfillTimeZone({ id: 7 }), {
      wrapper: queryWrapper().wrapper,
    });

    await waitFor(() =>
      expect(logged).toHaveBeenCalledWith(expect.any(String), {
        message: "offline",
      }),
    );
    logged.mockRestore();
  });
});
