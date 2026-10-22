import type { EventLogListDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEventLogAdmin } from "./useEventLogAdmin";

const events = {
  items: [
    {
      id: "e1",
      event: "account_created",
      message: "Alex joined",
      blob: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      userId: null,
    },
  ],
  totalCount: 51,
  page: 1,
  limit: 50,
  totalPages: 2,
} satisfies EventLogListDto;

const listQueries: string[] = [];
let listStatus = 200;

serveApi(
  routes({
    "GET /eventlog": ({ request }) => {
      listQueries.push(new URL(request.url).search);
      return Response.json(events, { status: listStatus });
    },
  }),
);

afterEach(() => {
  listQueries.length = 0;
  listStatus = 200;
});

describe("useEventLogAdmin", () => {
  it("reads the first page of every event type and caches it", async () => {
    const { client, wrapper } = queryWrapper();
    const view = renderHook(() => useEventLogAdmin(""), { wrapper });

    await waitFor(() => expect(view.result.current.data).toEqual(events));
    expect(listQueries).toEqual(["?page=1&limit=50"]);
    expect(client.getQueryData(queryKeys.eventLogAdmin(1, 50, ""))).toEqual(
      events,
    );
  });

  it("filters by event type and reads the page asked for", async () => {
    const view = renderHook(
      () => useEventLogAdmin("sms_inbound"),
      queryWrapper(),
    );
    await waitFor(() => expect(view.result.current.data).toEqual(events));

    act(() => view.result.current.setPage(2));

    await waitFor(() =>
      expect(listQueries).toEqual([
        "?page=1&limit=50&eventType=sms_inbound",
        "?page=2&limit=50&eventType=sms_inbound",
      ]),
    );
  });

  it("reports a failed load", async () => {
    listStatus = 500;
    const view = renderHook(() => useEventLogAdmin(""), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toBeUndefined();
  });
});
