import { renderHook, waitFor } from "@testing-library/react";
import type { City } from "../client";
import { makeCity } from "../lib/testFixtures";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import { useCurrentUserLocation } from "./useCurrentUserLocation";

const oakland = makeCity();
let stored: City | null = oakland;
let loads = 0;

const api = serveApi(
  routes({
    "GET /user/mylocation": () => {
      loads += 1;
      return Response.json(stored ? { city: stored } : {});
    },
  }),
);

beforeEach(() => {
  stored = oakland;
  loads = 0;
});

const member = { id: 7, customCityString: "Near the bay" };

describe("useCurrentUserLocation", () => {
  it("shows the stored city", async () => {
    const view = renderHook(
      () => useCurrentUserLocation({ enabled: true, user: member }),
      { wrapper: queryWrapper().wrapper },
    );
    expect(view.result.current.currentUserLocationLoading).toBe(true);

    await waitFor(() =>
      expect(view.result.current.userLocationDisplayValue).toEqual(oakland),
    );
    expect(view.result.current.currentUserLocationLoading).toBe(false);
  });

  it("falls back to the custom city when none is stored", async () => {
    stored = null;
    const view = renderHook(
      () => useCurrentUserLocation({ enabled: true, user: member }),
      { wrapper: queryWrapper().wrapper },
    );

    await waitFor(() =>
      expect(view.result.current.currentUserLocationLoading).toBe(false),
    );
    expect(loads).toBe(1);
    expect(view.result.current.userLocationDisplayValue).toBe("Near the bay");
  });

  it("falls back to the custom city when the load fails", async () => {
    api.alsoServing({
      "GET /user/mylocation": () => {
        loads += 1;
        return Response.json({ message: "unavailable" }, { status: 503 });
      },
    });
    const view = renderHook(
      () => useCurrentUserLocation({ enabled: true, user: member }),
      { wrapper: queryWrapper({ retry: 3, retryDelay: 0 }).wrapper },
    );

    await waitFor(() =>
      expect(view.result.current.currentUserLocationLoading).toBe(false),
    );
    expect(loads).toBe(1);
    expect(view.result.current.userLocationDisplayValue).toBe("Near the bay");
  });

  it("keeps the cached city when a reload fails", async () => {
    const { wrapper } = queryWrapper();
    const read = () =>
      renderHook(
        () => useCurrentUserLocation({ enabled: true, user: member }),
        { wrapper },
      );
    const first = read();
    await waitFor(() =>
      expect(first.result.current.userLocationDisplayValue).toEqual(oakland),
    );
    first.unmount();

    api.alsoServing({
      "GET /user/mylocation": () => {
        loads += 1;
        return Response.json({ message: "unavailable" }, { status: 503 });
      },
    });
    const second = read();
    await waitFor(() => expect(loads).toBe(2));
    await waitFor(() =>
      expect(second.result.current.currentUserLocationLoading).toBe(false),
    );

    expect(second.result.current.userLocationDisplayValue).toEqual(oakland);
  });

  it("asks nothing while disabled", () => {
    const view = renderHook(
      () => useCurrentUserLocation({ enabled: false, user: member }),
      { wrapper: queryWrapper().wrapper },
    );

    expect(view.result.current).toEqual({
      currentUserLocationLoading: false,
      userLocationDisplayValue: "Near the bay",
    });
    expect(loads).toBe(0);
  });

  it("shows only the custom city once disabled, though a city is cached", async () => {
    const view = renderHook(
      ({ enabled }) => useCurrentUserLocation({ enabled, user: member }),
      { initialProps: { enabled: true }, wrapper: queryWrapper().wrapper },
    );
    await waitFor(() =>
      expect(view.result.current.userLocationDisplayValue).toEqual(oakland),
    );

    view.rerender({ enabled: false });

    expect(view.result.current.userLocationDisplayValue).toBe("Near the bay");
  });

  it("asks the server again on the next mount, whatever the app's staleTime", async () => {
    const { wrapper } = queryWrapper({ staleTime: 5 * 60 * 1000 });
    const read = () =>
      renderHook(
        () => useCurrentUserLocation({ enabled: true, user: member }),
        { wrapper },
      );
    const first = read();
    await waitFor(() =>
      expect(first.result.current.userLocationDisplayValue).toEqual(oakland),
    );
    first.unmount();

    stored = makeCity({ id: 2, name: "Tucson" });
    const second = read();

    expect(second.result.current.userLocationDisplayValue).toEqual(oakland);
    await waitFor(() =>
      expect(second.result.current.userLocationDisplayValue).toEqual(stored),
    );
  });
});
