import { act, renderHook, waitFor } from "@testing-library/react";
import type { City, SubmitFormDto } from "../client";
import { makeCity, makeFormResponse } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyLocation } from "./useMyLocation";
import { useTaskFormSubmission } from "./useTaskFormSubmission";
import { useUpdateProfileMutation } from "./user";

const oakland = makeCity();
const tucson = makeCity({ id: 2, name: "Tucson", admin1: "Arizona" });

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

const memberId = 7;

describe("useMyLocation", () => {
  it("asks the server again on each mount, whatever the app's staleTime", async () => {
    const { wrapper } = queryWrapper({ staleTime: 5 * 60 * 1000 });
    const read = () => renderHook(() => useMyLocation(memberId), { wrapper });
    const first = read();
    await waitFor(() => expect(first.result.current.data).toEqual(oakland));
    first.unmount();

    stored = tucson;
    const second = read();

    await waitFor(() => expect(second.result.current.data).toEqual(tucson));
    expect(loads).toBe(2);
  });

  it("does not retry a failed load, whatever the app's retries", async () => {
    api.alsoServing({
      "GET /user/mylocation": () => {
        loads += 1;
        return Response.json({ message: "unavailable" }, { status: 503 });
      },
    });
    const view = renderHook(() => useMyLocation(memberId), {
      wrapper: queryWrapper({ retry: 3, retryDelay: 0 }).wrapper,
    });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(loads).toBe(1);
  });
});

const renderWithWriters = async () => {
  const { wrapper } = queryWrapper();
  const view = renderHook(
    () => ({
      location: useMyLocation(memberId),
      updateProfile: useUpdateProfileMutation(memberId),
      submission: useTaskFormSubmission(),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(view.result.current.location.data).toEqual(oakland),
  );
  return view;
};

describe("writes that change the location", () => {
  beforeEach(() => {
    api.alsoServing({
      "POST /user/update": () => Response.json({ id: memberId }),
      "POST /tasks/submitForm/:id": () =>
        Response.json(makeFormResponse(), { status: 201 }),
      "GET /user/myvisibilitycontext": () => Response.json({}),
    });
  });

  it("a saved city refreshes it", async () => {
    const view = await renderWithWriters();

    stored = tucson;
    await act(() =>
      view.result.current.updateProfile.mutateAsync({ cityId: tucson.id }),
    );

    await waitFor(() =>
      expect(view.result.current.location.data).toEqual(tucson),
    );
  });

  it("a save that leaves the city alone does not", async () => {
    const view = await renderWithWriters();

    await act(() =>
      view.result.current.updateProfile.mutateAsync({ name: "Maya Rowan" }),
    );

    await waitFor(() =>
      expect(view.result.current.updateProfile.isSuccess).toBe(true),
    );
    expect(loads).toBe(1);
  });

  it("a member's accepted submission refreshes it", async () => {
    const view = await renderWithWriters();
    const body: SubmitFormDto = {
      answers: {},
      actionId: 1,
      deviceType: "mobile",
    };

    stored = null;
    await act(() =>
      view.result.current.submission.submit({
        taskFormId: 3,
        body,
        isMember: true,
      }),
    );

    await waitFor(() => expect(view.result.current.location.data).toBeNull());
  });
});
