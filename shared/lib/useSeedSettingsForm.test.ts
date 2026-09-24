import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useSeedSettingsForm } from "./useSeedSettingsForm";

let seedings = 0;
let refusals = 0;

const table = {
  "GET /auth/me": () => {
    seedings += 1;
    if (refusals > 0) {
      refusals -= 1;
      return Response.json({ message: "unavailable" }, { status: 503 });
    }
    return Response.json({ user: { id: 7 } });
  },
  "GET /user/mylocation": () => Response.json({ city: null }),
};

const api = serveApi(routes(table));

beforeEach(() => {
  seedings = 0;
  refusals = 0;
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const seed = (user: { id: number }) => {
  const setSavedProfile = jest.fn();
  const setLocation = jest.fn();
  const view = renderHook(
    ({ user }) => useSeedSettingsForm({ user, setSavedProfile, setLocation }),
    { initialProps: { user }, wrapper: queryWrapper().wrapper },
  );
  return { setSavedProfile, view };
};

describe("useSeedSettingsForm", () => {
  it("seeds once, however often the user object is replaced", async () => {
    const { setSavedProfile, view } = seed({ id: 7 });
    await waitFor(() => expect(view.result.current).toBe(false));

    view.rerender({ user: { id: 7 } });
    view.rerender({ user: { id: 7 } });

    await waitFor(() => expect(setSavedProfile).toHaveBeenCalledTimes(1));
    expect(seedings).toBe(1);
  });

  it("seeds again for a different member on the same mount", async () => {
    const { setSavedProfile, view } = seed({ id: 7 });
    view.rerender({ user: { id: 8 } });

    await waitFor(() => expect(setSavedProfile).toHaveBeenCalledTimes(2));
    expect(seedings).toBe(2);
  });

  it.each([
    ["returns the refusal", () => {}],
    ["throws the refusal", () => api.throwingOnRefusal(table)],
  ])(
    "does not seed again after a failed load when the client %s",
    async (_, serve) => {
      serve();
      refusals = 1;
      const logged = jest.spyOn(console, "error").mockImplementation(() => {});
      const { setSavedProfile, view } = seed({ id: 7 });
      await waitFor(() => expect(view.result.current).toBe(false));

      view.rerender({ user: { id: 7 } });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(setSavedProfile).not.toHaveBeenCalled();
      expect(seedings).toBe(1);
      expect(logged).toHaveBeenCalledTimes(1);
    },
  );
});
