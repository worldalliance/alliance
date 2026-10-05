import type { WaitlistCohortDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCreateWaitlistCohortAdmin,
  useDeleteWaitlistCohortAdmin,
  useUpdateWaitlistCohortAdmin,
  useWaitlistCohortsAdmin,
} from "./useWaitlistCohortsAdmin";

afterEach(cleanup);

const cohort = {
  id: 3,
  name: "Waiting",
  filter: { mobilized: false },
  updatedAt: "2026-08-01T00:00:00.000Z",
} satisfies WaitlistCohortDto;

let stored: WaitlistCohortDto[] = [cohort];
let writeStatus = 200;

const refuse = () => {
  stored = [{ ...cohort, name: "Changed elsewhere" }];
  return Response.json({}, { status: writeStatus });
};

serveApi(
  routes({
    "GET /waitlist/admin/cohorts": () => Response.json(stored),
    "POST /waitlist/admin/cohorts": async ({ request }) => {
      if (writeStatus !== 200) return refuse();
      const body: Pick<WaitlistCohortDto, "name" | "filter"> =
        await request.json();
      const created = { ...cohort, ...body, id: 4 };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /waitlist/admin/cohorts/:id": async ({ request, params }) => {
      if (writeStatus !== 200) return refuse();
      const body: Pick<WaitlistCohortDto, "filter"> = await request.json();
      const saved = { ...cohort, ...body, id: Number(params.id) };
      stored = stored.map((c) => (c.id === saved.id ? saved : c));
      return Response.json(saved);
    },
    "DELETE /waitlist/admin/cohorts/:id": ({ params }) => {
      if (writeStatus !== 200) return refuse();
      stored = stored.filter((c) => String(c.id) !== params.id);
      return Response.json(null);
    },
  }),
);

afterEach(() => {
  stored = [cohort];
  writeStatus = 200;
});

// Records the list as written by the hook, before the invalidation refetch.
const callbacks = (query: ReturnType<typeof queryWrapper>) => {
  const listed: { onSuccess?: WaitlistCohortDto[] } = {};
  return {
    listed,
    onSuccess: jest.fn(() => {
      listed.onSuccess = query.client.getQueryData(
        queryKeys.waitlistCohortsAdmin(),
      );
    }),
    onError: jest.fn(),
    onSettled: jest.fn(),
  };
};

const renderWith = <T>(
  useMutationHook: (cb: ReturnType<typeof callbacks>) => T,
) => {
  const query = queryWrapper();
  const cb = callbacks(query);
  const view = renderHook(
    () => ({
      cohorts: useWaitlistCohortsAdmin(),
      mutation: useMutationHook(cb),
    }),
    query,
  );
  return { view, cb };
};

describe("useWaitlistCohortsAdmin", () => {
  it("loads the cohorts", async () => {
    const view = renderHook(() => useWaitlistCohortsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([cohort]));
  });
});

describe("useCreateWaitlistCohortAdmin", () => {
  it("adds a created cohort to the list", async () => {
    const { view, cb } = renderWith(useCreateWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate({
      name: "Reasoned",
      filter: { hasReason: true },
    });

    await waitFor(() =>
      expect(view.result.current.cohorts.data?.map((c) => c.name)).toEqual([
        "Waiting",
        "Reasoned",
      ]),
    );
    expect(cb.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, name: "Reasoned" }),
    );
    expect(cb.listed.onSuccess?.map((c) => c.name)).toEqual([
      "Waiting",
      "Reasoned",
    ]);
  });

  it("refetches the list after a refused create", async () => {
    writeStatus = 409;
    const { view, cb } = renderWith(useCreateWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate({ name: "Reasoned", filter: {} });

    await waitFor(() =>
      expect(view.result.current.cohorts.data?.[0].name).toBe(
        "Changed elsewhere",
      ),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
  });
});

describe("useUpdateWaitlistCohortAdmin", () => {
  it("replaces an updated cohort in the list", async () => {
    const { view, cb } = renderWith(useUpdateWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate({ id: 3, filter: { hasReason: true } });

    const updated = { ...cohort, filter: { hasReason: true } };
    await waitFor(() =>
      expect(view.result.current.cohorts.data).toEqual([updated]),
    );
    expect(cb.onSuccess).toHaveBeenCalledWith(updated);
    expect(cb.listed.onSuccess).toEqual([updated]);
    expect(cb.onSettled).toHaveBeenCalled();
  });

  it("refetches the list after a refused update", async () => {
    writeStatus = 409;
    const { view, cb } = renderWith(useUpdateWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate({ id: 3, filter: {} });

    await waitFor(() =>
      expect(view.result.current.cohorts.data?.[0].name).toBe(
        "Changed elsewhere",
      ),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
  });
});

describe("useDeleteWaitlistCohortAdmin", () => {
  it("drops a deleted cohort from the list", async () => {
    const { view, cb } = renderWith(useDeleteWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate(3);

    await waitFor(() => expect(view.result.current.cohorts.data).toEqual([]));
    expect(cb.onSuccess).toHaveBeenCalled();
    expect(cb.listed.onSuccess).toEqual([]);
    expect(cb.onSettled).toHaveBeenCalled();
  });

  it("refetches the list after a refused delete", async () => {
    writeStatus = 409;
    const { view, cb } = renderWith(useDeleteWaitlistCohortAdmin);
    await waitFor(() => expect(view.result.current.cohorts.data).toBeTruthy());

    view.result.current.mutation.mutate(3);

    await waitFor(() =>
      expect(view.result.current.cohorts.data?.[0].name).toBe(
        "Changed elsewhere",
      ),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
  });
});
