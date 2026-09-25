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

const backfill = (
  user: Parameters<typeof useBackfillTimeZone>[0],
  options?: Partial<Parameters<typeof useBackfillTimeZone>[1]>,
) => useBackfillTimeZone(user, { detect: deviceTimeZone, ...options });

describe("useBackfillTimeZone", () => {
  it("sends the device zone for a member who has none", async () => {
    renderHook(() => backfill({ id: 7, timeZone: null }), {
      wrapper: queryWrapper().wrapper,
    });

    await waitFor(() =>
      expect(payloads).toEqual([{ timeZone: deviceTimeZone() }]),
    );
  });

  it("sends a valid alias as detected", async () => {
    renderHook(
      () => backfill({ id: 7, timeZone: null }, { detect: () => "US/Pacific" }),
      {
        wrapper: queryWrapper().wrapper,
      },
    );

    await waitFor(() => expect(payloads).toEqual([{ timeZone: "US/Pacific" }]));
  });

  it.each([
    undefined,
    "",
    "-08:00",
    "america/los_angeles",
    "Mars/Olympus_Mons",
  ])("writes nothing when detection gives %p", async (detected) => {
    renderHook(
      () => backfill({ id: 7, timeZone: null }, { detect: () => detected }),
      {
        wrapper: queryWrapper().wrapper,
      },
    );

    await settle();
    expect(payloads).toEqual([]);
  });

  it("leaves a member who already has one alone", async () => {
    renderHook(() => backfill({ id: 7, timeZone: "Europe/Berlin" }), {
      wrapper: queryWrapper().wrapper,
    });

    await settle();
    expect(payloads).toEqual([]);
  });

  it("does nothing before the user loads", async () => {
    const view = renderHook(({ user }) => backfill(user), {
      initialProps: {
        user: undefined as { id: number; timeZone: null } | undefined,
      },
      wrapper: queryWrapper().wrapper,
    });
    await settle();
    expect(payloads).toEqual([]);

    view.rerender({ user: { id: 7, timeZone: null } });
    await waitFor(() => expect(payloads).toHaveLength(1));
  });

  it("sends once, however often the user object is replaced", async () => {
    const view = renderHook(({ user }) => backfill(user), {
      initialProps: { user: { id: 7, timeZone: null } },
      wrapper: queryWrapper().wrapper,
    });
    view.rerender({ user: { id: 7, timeZone: null } });
    view.rerender({ user: { id: 7, timeZone: null } });

    await settle();
    expect(payloads).toHaveLength(1);
  });

  it("sends again for a different member on the same mount", async () => {
    const view = renderHook(({ user }) => backfill(user), {
      initialProps: { user: { id: 7, timeZone: null } },
      wrapper: queryWrapper().wrapper,
    });
    view.rerender({ user: { id: 8, timeZone: null } });

    await waitFor(() => expect(payloads).toHaveLength(2));
  });

  it("writes nothing while disabled, and sends once enabled", async () => {
    const view = renderHook(
      ({ enabled }) => backfill({ id: 7, timeZone: null }, { enabled }),
      {
        initialProps: { enabled: false },
        wrapper: queryWrapper().wrapper,
      },
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

    renderHook(() => backfill({ id: 7, timeZone: null }), {
      wrapper: queryWrapper().wrapper,
    });

    await waitFor(() =>
      expect(logged).toHaveBeenCalledWith(expect.any(String), {
        message: "offline",
        statusCode: 500,
      }),
    );
  });
});
