import type { MmsThreadDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  focusManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import {
  LIST_REFETCH_MS,
  listenToMmsThreads,
  refetchChangedThread,
} from "./mmsThreadsLive";

const thread = (phoneNumber: string | null) =>
  ({ phoneNumber }) satisfies Pick<MmsThreadDto, "phoneNumber">;

const setup = () => {
  const client = new QueryClient();
  client.setQueryData(
    queryKeys.memberTextThreadAdmin(1),
    thread("+14155550001"),
  );
  client.setQueryData(
    queryKeys.memberTextThreadAdmin(2),
    thread("+14155550002"),
  );
  client.setQueryData(
    queryKeys.numberTextThreadAdmin("a"),
    thread("+14155550001"),
  );
  client.setQueryData(queryKeys.needsReplyAdmin(), []);
  client.setQueryData(queryKeys.textThreadsAdmin({ page: 1, search: "" }), {
    threads: [],
    hasMore: false,
  });
  const invalidated = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated;
  return { client, invalidated };
};

it("refetches only the threads on the changed number, and those still loading", () => {
  const { client, invalidated } = setup();
  client
    .getQueryCache()
    .build(client, { queryKey: queryKeys.memberTextThreadAdmin(3) });

  refetchChangedThread(client, "+14155550001");

  expect(invalidated(queryKeys.memberTextThreadAdmin(1))).toBe(true);
  expect(invalidated(queryKeys.numberTextThreadAdmin("a"))).toBe(true);
  expect(invalidated(queryKeys.memberTextThreadAdmin(2))).toBe(false);
  expect(invalidated(queryKeys.memberTextThreadAdmin(3))).toBe(true);
});

const loading = (client: QueryClient, queryKey: readonly unknown[]) => {
  const queryFn = jest.fn(
    () => new Promise((resolve) => setTimeout(() => resolve(null), 50)),
  );
  const unsubscribe = new QueryObserver(client, {
    queryKey,
    queryFn,
  }).subscribe(() => {});
  return { queryFn, unsubscribe };
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 100));

it("refetches a thread whose first load failed", async () => {
  const { client } = setup();
  const queryFn = jest.fn(() => Promise.reject(new Error("offline")));
  const unsubscribe = new QueryObserver(client, {
    queryKey: queryKeys.memberTextThreadAdmin(3),
    queryFn,
    retry: false,
  }).subscribe(() => {});
  await settled();

  refetchChangedThread(client, "+14155550001");
  await settled();

  expect(queryFn).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it("fetches a hidden tab's changed thread once the tab is shown", async () => {
  const { client } = setup();
  client.mount();
  const queryFn = jest.fn(() => Promise.resolve(thread("+14155550001")));
  const unsubscribe = new QueryObserver(client, {
    queryKey: queryKeys.memberTextThreadAdmin(1),
    queryFn,
  }).subscribe(() => {});
  await settled();
  focusManager.setFocused(false);

  refetchChangedThread(client, "+14155550001");
  await settled();
  expect(queryFn).toHaveBeenCalledTimes(1);

  focusManager.setFocused(true);
  await settled();
  expect(queryFn).toHaveBeenCalledTimes(2);
  focusManager.setFocused(undefined);
  unsubscribe();
  client.unmount();
});

it("leaves a thread the server refused to load until the poll", async () => {
  const { client } = setup();
  const queryFn = jest.fn(() =>
    Promise.reject(Object.assign(new Error("nope"), { statusCode: 404 })),
  );
  const unsubscribe = new QueryObserver(client, {
    queryKey: queryKeys.memberTextThreadAdmin(3),
    queryFn,
    retry: false,
  }).subscribe(() => {});
  await settled();

  refetchChangedThread(client, "+14155550001");
  await settled();

  expect(queryFn).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("applies a loaded thread's fetches through a stream of changes", async () => {
  const { client } = setup();
  const queryKey = queryKeys.memberTextThreadAdmin(1);
  const unsubscribe = new QueryObserver(client, {
    queryKey,
    queryFn: () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(thread("+14155550001")), 50),
      ),
  }).subscribe(() => {});

  for (let i = 0; i < 10; i++) {
    refetchChangedThread(client, "+14155550001");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  expect(client.getQueryState(queryKey)?.dataUpdateCount).toBeGreaterThan(2);
  unsubscribe();
});

it("fetches again a thread whose first load is in flight, once it settles", async () => {
  const { client } = setup();
  const { queryFn, unsubscribe } = loading(
    client,
    queryKeys.memberTextThreadAdmin(3),
  );

  refetchChangedThread(client, "+14155550001");
  expect(queryFn).toHaveBeenCalledTimes(1);
  await settled();

  expect(queryFn).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it("lets a first load finish through a stream of changes, fetching it once more", async () => {
  const { client } = setup();
  const { queryFn, unsubscribe } = loading(
    client,
    queryKeys.memberTextThreadAdmin(3),
  );

  for (let i = 0; i < 5; i++) refetchChangedThread(client, "+14155550001");
  await settled();

  expect(queryFn).toHaveBeenCalledTimes(2);
  expect(client.getQueryState(queryKeys.memberTextThreadAdmin(3))?.status).toBe(
    "success",
  );
  unsubscribe();
});

const listening = () => {
  const { client, invalidated } = setup();
  const listeners = new Map<string, (data: unknown) => void>();
  const states: boolean[] = [];
  listenToMmsThreads({
    socket: { on: (event, listener) => listeners.set(event, listener) },
    queryClient: client,
    setConnected: (connected) => states.push(connected),
  });
  const push = (event: string, data?: unknown) => listeners.get(event)?.(data);
  const changed = (needsReplyChanged: boolean) =>
    push("thread-changed", { phoneNumber: "+14155550002", needsReplyChanged });
  return { client, invalidated, states, push, changed };
};

it("refetches every thread, Needs reply and the Texts list on each connect", () => {
  const { invalidated, states, push } = listening();
  push("connect");
  expect(states).toEqual([true]);
  expect(invalidated(queryKeys.memberTextThreadAdmin(1))).toBe(true);
  expect(invalidated(queryKeys.memberTextThreadAdmin(2))).toBe(true);
  expect(invalidated(queryKeys.numberTextThreadAdmin("a"))).toBe(true);
  expect(invalidated(queryKeys.needsReplyAdmin())).toBe(true);
  expect(invalidated(queryKeys.textThreadsAdmin({ page: 1, search: "" }))).toBe(
    true,
  );
});

it("fetches again a Needs reply first load in flight on connect", async () => {
  const { client, push } = listening();
  client.removeQueries({ queryKey: queryKeys.needsReplyAdmin() });
  const { queryFn, unsubscribe } = loading(client, queryKeys.needsReplyAdmin());

  push("connect");
  await settled();

  expect(queryFn).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it("reports a disconnect, so queries poll at their usual rate", () => {
  const { states, push } = listening();
  push("connect");
  push("disconnect");
  expect(states).toEqual([true, false]);
});

it("refetches the thread a push names", () => {
  const { invalidated, push } = listening();
  push("thread-changed", {
    phoneNumber: "+14155550002",
    needsReplyChanged: false,
  });
  expect(invalidated(queryKeys.memberTextThreadAdmin(1))).toBe(false);
  expect(invalidated(queryKeys.memberTextThreadAdmin(2))).toBe(true);
});

it("refetches Needs reply for a change that can affect it", () => {
  const { invalidated, changed } = listening();
  changed(false);
  expect(invalidated(queryKeys.needsReplyAdmin())).toBe(false);
  changed(true);
  expect(invalidated(queryKeys.needsReplyAdmin())).toBe(true);
});

it("refetches Needs reply at most once per interval through a burst of changes", () => {
  jest.useFakeTimers();
  try {
    const { client, changed } = listening();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const needsReplyRefetches = () =>
      invalidate.mock.calls.filter(
        ([filters]) =>
          filters?.queryKey?.[0] === queryKeys.needsReplyAdmin()[0],
      ).length;

    changed(true);
    changed(true);
    changed(true);
    expect(needsReplyRefetches()).toBe(1);

    jest.advanceTimersByTime(LIST_REFETCH_MS);
    expect(needsReplyRefetches()).toBe(2);
  } finally {
    jest.useRealTimers();
  }
});

it("refetches the Texts list on any change, at most once per interval", () => {
  jest.useFakeTimers();
  try {
    const { client, changed } = listening();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const listRefetches = () =>
      invalidate.mock.calls.filter(
        ([filters]) =>
          filters?.queryKey?.[0] === queryKeys.textThreadsAdminAll()[0],
      ).length;

    changed(false);
    changed(true);
    expect(listRefetches()).toBe(1);

    jest.advanceTimersByTime(LIST_REFETCH_MS);
    expect(listRefetches()).toBe(2);
  } finally {
    jest.useRealTimers();
  }
});

it("throws on a malformed push", () => {
  const { push } = listening();
  expect(() => push("thread-changed", { phoneNumber: 1 })).toThrow();
});
