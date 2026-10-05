import type {
  WaitlistEntryFilterDto,
  WaitlistEntryPageDto,
  WaitlistEntrySearchDto,
  WaitlistMetricsDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useChangeWaitlistEntriesAdmin,
  useFindWaitlistEntryIdsAdmin,
  useWaitlistEntriesAdmin,
  useWaitlistEntryMetricsAdmin,
  WaitlistEntryChange,
} from "./useWaitlistEntriesAdmin";

afterEach(cleanup);

const page = (total: number) =>
  ({ entries: [], total }) satisfies WaitlistEntryPageDto;

const metrics = (waiting: number) =>
  ({
    status: {
      entries: waiting,
      waiting,
      mobilized: 0,
      inviteClaimed: 0,
      inviteClaims: 0,
    },
    inviteEmails: {
      emailed: 0,
      claimed: 0,
      timedClaims: 0,
      medianSecondsToClaim: null,
    },
    weeks: [],
    sources: [],
    conversions: [],
  }) satisfies WaitlistMetricsDto;

const requests: unknown[] = [];
let writeStatus = 200;

const changeEntries =
  (path: string) =>
  async ({ request }: { request: Request }) => {
    const body: { entryIds: number[] } = await request.json();
    requests.push({ path, ...body });
    if (writeStatus !== 200) return Response.json({}, { status: writeStatus });
    return Response.json({ changed: body.entryIds.length });
  };

serveApi(
  routes({
    "POST /waitlist/admin/entries/search": async ({ request }) => {
      const body: WaitlistEntrySearchDto = await request.json();
      requests.push(body);
      return Response.json(page(body.offset ?? 0));
    },
    "POST /waitlist/admin/entries/metrics": async ({ request }) => {
      const body: { filter: WaitlistEntryFilterDto } = await request.json();
      requests.push(body);
      return Response.json(metrics(body.filter.mobilized ? 1 : 2));
    },
    "POST /waitlist/admin/entries/ids": async ({ request }) => {
      const body: { filter: WaitlistEntryFilterDto } = await request.json();
      requests.push(body);
      if (writeStatus !== 200) {
        return Response.json({}, { status: writeStatus });
      }
      return Response.json({ ids: [1, 2] });
    },
    "POST /waitlist/admin/entries/mobilize": changeEntries("mobilize"),
    "POST /waitlist/admin/entries/unmobilize": changeEntries("unmobilize"),
    "POST /waitlist/admin/entries/revoke-invites":
      changeEntries("revoke-invites"),
  }),
);

afterEach(() => {
  requests.length = 0;
  writeStatus = 200;
});

describe("useWaitlistEntriesAdmin", () => {
  it("loads the page the search asks for", async () => {
    const search = {
      filter: {},
      sort: "joined_desc",
      offset: 50,
      limit: 50,
    } satisfies WaitlistEntrySearchDto;
    const view = renderHook(
      () => useWaitlistEntriesAdmin(search),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(page(50)));
    expect(requests).toEqual([search]);
  });

  it("keeps the previous page while the next one loads", async () => {
    const view = renderHook(
      ({ offset }) =>
        useWaitlistEntriesAdmin({
          filter: {},
          sort: "joined_desc",
          offset,
          limit: 50,
        }),
      { ...queryWrapper(), initialProps: { offset: 0 } },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(page(0)));

    view.rerender({ offset: 50 });

    expect(view.result.current.isPlaceholderData).toBe(true);
    expect(view.result.current.data).toEqual(page(0));
    await waitFor(() => expect(view.result.current.data).toEqual(page(50)));
  });
});

describe("useWaitlistEntryMetricsAdmin", () => {
  it("loads the metrics for the filter", async () => {
    const view = renderHook(
      () => useWaitlistEntryMetricsAdmin({ mobilized: true }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(metrics(1)));
    expect(requests).toEqual([{ filter: { mobilized: true } }]);
  });

  it("keeps the previous metrics while the next filter loads", async () => {
    const everyEntry: WaitlistEntryFilterDto = {};
    const view = renderHook(
      ({ filter }) => useWaitlistEntryMetricsAdmin(filter),
      {
        ...queryWrapper(),
        initialProps: { filter: everyEntry },
      },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(metrics(2)));

    view.rerender({ filter: { mobilized: true } });

    expect(view.result.current.isPlaceholderData).toBe(true);
    expect(view.result.current.data).toEqual(metrics(2));
    await waitFor(() => expect(view.result.current.data).toEqual(metrics(1)));
  });

  it("refetches when the entries change", async () => {
    const query = queryWrapper();
    const view = renderHook(() => useWaitlistEntryMetricsAdmin({}), query);
    await waitFor(() => expect(view.result.current.data).toBeTruthy());

    await query.client.invalidateQueries({
      queryKey: queryKeys.waitlistEntriesAdminAll(),
    });

    expect(requests).toHaveLength(2);
  });
});

describe("useFindWaitlistEntryIdsAdmin", () => {
  it("finds the ids matching the filter", async () => {
    const onError = jest.fn();
    const view = renderHook(
      () => useFindWaitlistEntryIdsAdmin({ onError }),
      queryWrapper(),
    );

    const ids = await view.result.current.mutateAsync({ mobilized: false });

    expect(ids).toEqual([1, 2]);
    expect(requests).toEqual([{ filter: { mobilized: false } }]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a refusal", async () => {
    writeStatus = 403;
    const onError = jest.fn();
    const view = renderHook(
      () => useFindWaitlistEntryIdsAdmin({ onError }),
      queryWrapper(),
    );

    view.result.current.mutate({});

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

describe("useChangeWaitlistEntriesAdmin", () => {
  const renderChange = () => {
    const callbacks = {
      onSuccess: jest.fn(),
      onError: jest.fn(),
      onSettled: jest.fn(),
    };
    const query = queryWrapper();
    query.client.setQueryData(queryKeys.waitlistEntriesAdminAll(), []);
    const view = renderHook(
      () => useChangeWaitlistEntriesAdmin(callbacks),
      query,
    );
    const entriesInvalidated = () =>
      query.client.getQueryState(queryKeys.waitlistEntriesAdminAll())
        ?.isInvalidated;
    return { view, callbacks, entriesInvalidated };
  };

  it.each([
    [WaitlistEntryChange.Mark, "mobilize"],
    [WaitlistEntryChange.Undo, "unmobilize"],
    [WaitlistEntryChange.RevokeInvites, "revoke-invites"],
  ])("sends %s to %s and refreshes the entries", async (kind, path) => {
    const { view, callbacks, entriesInvalidated } = renderChange();

    view.result.current.mutate({ kind, entryIds: [1, 2, 3] });

    await waitFor(() => expect(entriesInvalidated()).toBe(true));
    expect(requests).toEqual([{ path, entryIds: [1, 2, 3] }]);
    expect(callbacks.onSuccess).toHaveBeenCalledWith(3, kind);
    expect(callbacks.onSettled).toHaveBeenCalled();
  });

  it("reports a refusal with its kind and still refreshes", async () => {
    writeStatus = 409;
    const { view, callbacks, entriesInvalidated } = renderChange();

    view.result.current.mutate({
      kind: WaitlistEntryChange.Undo,
      entryIds: [1],
    });

    await waitFor(() => expect(entriesInvalidated()).toBe(true));
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.anything(),
      WaitlistEntryChange.Undo,
    );
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(callbacks.onSettled).toHaveBeenCalled();
  });
});
