import { cleanup, renderHook } from "@testing-library/react";
import type { UpdateProfileDto } from "../client";

const mutate = jest.fn();

jest.mock("./user", () => ({
  useUpdateProfileMutation: () => ({ mutate }),
}));

import { deviceTimeZone } from "./timeZone";
import { useBackfillTimeZone } from "./useBackfillTimeZone";

afterEach(() => {
  mutate.mockReset();
  cleanup();
});

const payloads = (): UpdateProfileDto[] => mutate.mock.calls.map(([p]) => p);

describe("useBackfillTimeZone", () => {
  it("sends the device zone for a member who has none", () => {
    renderHook(() => useBackfillTimeZone({ id: 7 }));
    expect(payloads()).toEqual([{ timeZone: deviceTimeZone() }]);
  });

  it("leaves a member who already has one alone", () => {
    renderHook(() => useBackfillTimeZone({ id: 7, timeZone: "Europe/Berlin" }));
    expect(payloads()).toEqual([]);
  });

  it("does nothing before the user loads", () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: undefined as { id: number } | undefined },
    });
    expect(payloads()).toEqual([]);

    view.rerender({ user: { id: 7 } });
    expect(payloads()).toHaveLength(1);
  });

  it("sends once, however often the user object is replaced", () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: { id: 7 } },
    });
    view.rerender({ user: { id: 7 } });
    view.rerender({ user: { id: 7 } });
    expect(payloads()).toHaveLength(1);
  });

  it("sends again for a different member on the same mount", () => {
    const view = renderHook(({ user }) => useBackfillTimeZone(user), {
      initialProps: { user: { id: 7 } },
    });
    view.rerender({ user: { id: 8 } });
    expect(payloads()).toHaveLength(2);
  });

  it("writes nothing while disabled, and sends once enabled", () => {
    const view = renderHook(
      ({ enabled }) => useBackfillTimeZone({ id: 7 }, { enabled }),
      { initialProps: { enabled: false } },
    );
    expect(payloads()).toEqual([]);

    view.rerender({ enabled: true });
    expect(payloads()).toEqual([{ timeZone: deviceTimeZone() }]);
  });

  it("logs a failed write", () => {
    const failure = new Error("offline");
    mutate.mockImplementation((_payload, options) => options.onError(failure));
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useBackfillTimeZone({ id: 7 }));

    expect(logged).toHaveBeenCalledWith(expect.any(String), failure);
    logged.mockRestore();
  });
});
