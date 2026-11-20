import type { NeedsReplyThreadDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { createElement, type ReactNode } from "react";
import { MmsThreadsLiveContext, OFFLINE } from "./mmsThreadsLive";
import { useMemberTextsAdmin } from "./useMemberTextsAdmin";
import {
  useNeedsReplyAdmin,
  useNeedsReplyCount,
  useNumberThreadAdmin,
} from "./useTextThreadsAdmin";

const waiting = (n: number): NeedsReplyThreadDto => ({
  threadId: `00000000-0000-4000-8000-00000000000${n}`,
  phoneNumber: `+1415555010${n}`,
  members: [],
  lastMessageBody: "Hello?",
  waitingSince: "2026-11-01T00:00:00.000Z",
});

let respond: () => Response | Promise<Response>;

serveApi(
  routes({
    "GET /mms-threads/needs-reply-threads": () => respond(),
    "GET /mms-threads/7": () => new Promise(() => {}),
    "GET /mms-threads/by-id/:threadId": () => new Promise(() => {}),
  }),
);

beforeEach(() => {
  respond = () => Response.json([waiting(1), waiting(2)]);
});

it("counts the numbers waiting", async () => {
  const view = renderHook(useNeedsReplyCount, queryWrapper());

  await waitFor(() => expect(view.result.current).toBe(2));
});

it("counts nobody while the list loads", () => {
  respond = () => new Promise(() => {});

  const view = renderHook(useNeedsReplyCount, queryWrapper());

  expect(view.result.current).toBe(0);
});

it("gives no count when the list has never loaded", async () => {
  respond = () => Response.json({ message: "down" }, { status: 500 });

  const view = renderHook(useNeedsReplyCount, queryWrapper());

  await waitFor(() => expect(view.result.current).toBeNull());
});

it("keeps the last count when a later poll fails", async () => {
  const { wrapper, client } = queryWrapper();
  const view = renderHook(
    () => ({ count: useNeedsReplyCount(), list: useNeedsReplyAdmin() }),
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.count).toBe(2));
  respond = () => Response.json({ message: "down" }, { status: 500 });

  await client.refetchQueries({ queryKey: queryKeys.needsReplyAdmin() });

  await waitFor(() => expect(view.result.current.list.isError).toBe(true));
  expect(view.result.current.count).toBe(2);
});

const pollIntervals = (connected: boolean) => {
  const { wrapper, client } = queryWrapper();
  renderHook(
    () => {
      useNeedsReplyAdmin();
      useMemberTextsAdmin(7);
      useNumberThreadAdmin(waiting(1).threadId);
    },
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          MmsThreadsLiveContext.Provider,
          { value: { ...OFFLINE, connected } },
          wrapper({ children }),
        ),
    },
  );
  const interval = (queryKey: readonly unknown[]) =>
    client.getQueryCache().find({ queryKey })?.observers[0]?.options
      .refetchInterval;
  return [
    interval(queryKeys.needsReplyAdmin()),
    interval(queryKeys.memberTextThreadAdmin(7)),
    interval(queryKeys.numberTextThreadAdmin(waiting(1).threadId)),
  ];
};

it("polls only as a backstop while the socket is connected", () => {
  expect(pollIntervals(true)).toEqual([
    milliseconds({ seconds: 60 }),
    milliseconds({ seconds: 60 }),
    milliseconds({ seconds: 60 }),
  ]);
  expect(pollIntervals(false)).toEqual([
    milliseconds({ seconds: 30 }),
    milliseconds({ seconds: 10 }),
    milliseconds({ seconds: 10 }),
  ]);
});
