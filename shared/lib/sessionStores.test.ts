import { CancelledError, QueryClient } from "@tanstack/react-query";
import {
  currentSession,
  endSession,
  sessionLoads,
  sessionStore,
} from "./sessionStores";

const counterStore = sessionStore(() => {
  let count = 0;
  return {
    get: () => count,
    add: () => void count++,
    clear: () => void (count = 0),
  };
});

const loadsOf = (queryClient: QueryClient) =>
  sessionLoads<number[]>({ queryClient, queryKey: ["numbers"] });

it("clears every store of the client only when the session ends", () => {
  const client = new QueryClient();
  const other = new QueryClient();
  counterStore(client).add();
  counterStore(other).add();

  // @ts-expect-error clearing a store without ending its session would let the previous viewer's loads land
  expect(counterStore(client).clear).toBeUndefined();

  endSession(client);
  expect(counterStore(client).get()).toBe(0);
  expect(counterStore(other).get()).toBe(1);
  expect(currentSession(client)).toBe(currentSession(other) + 1);
});

it("cancels a load whose session ended while it was in flight", async () => {
  const client = new QueryClient();
  const { promise, resolve } = Promise.withResolvers<number[]>();
  const load = loadsOf(client).load({
    signal: new AbortController().signal,
    fetch: () => promise,
  });
  endSession(client);
  resolve([1]);
  await expect(load).rejects.toBeInstanceOf(CancelledError);
});

const append = (n: number) => (numbers: number[]) => [...numbers, n];

const loadNow = (loads: ReturnType<typeof loadsOf>) =>
  loads
    .load({ signal: new AbortController().signal, fetch: async () => [] })
    .then(({ value }) => value);

it("replays an unconfirmed write over loads that start before it settles", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const confirmation = Promise.withResolvers<void>();
  loads.write(append(1), confirmation.promise);
  loads.write(append(2));

  expect(await loadNow(loads)).toEqual([1]);
  confirmation.resolve();
  await confirmation.promise;
  expect(await loadNow(loads)).toEqual([]);
});

it("stops replaying an unconfirmed write once its confirmation rejects", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const confirmation = Promise.withResolvers<void>();
  loads.write(append(1), confirmation.promise);
  confirmation.reject(new Error("refused"));
  await confirmation.promise.catch(() => {});
  expect(await loadNow(loads)).toEqual([]);
});

it("does not replay an unconfirmed write over a later session's loads", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  loads.write(append(1), new Promise(() => {}));
  endSession(client);
  expect(await loadNow(loads)).toEqual([]);
});

it("stops applying a refused write to a load already in flight", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const confirmation = Promise.withResolvers<void>();
  const fetched = Promise.withResolvers<number[]>();
  loads.write(append(1), confirmation.promise);
  const load = loads.load({
    signal: new AbortController().signal,
    fetch: () => fetched.promise,
  });
  confirmation.reject(new Error("refused"));
  await confirmation.promise.catch(() => {});
  fetched.resolve([]);
  expect((await load).value).toEqual([]);
});

it("applies an unconfirmed write before the writes made after it", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const fetched = Promise.withResolvers<number[]>();
  loads.write(append(1), new Promise(() => {}));
  const load = loads.load({
    signal: new AbortController().signal,
    fetch: () => fetched.promise,
  });
  loads.write(append(2));
  fetched.resolve([]);
  expect((await load).value).toEqual([1, 2]);
});

it("stops applying a write refused after a load already in flight started", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const fetched = Promise.withResolvers<number[]>();
  const load = loads.load({
    signal: new AbortController().signal,
    fetch: () => fetched.promise,
  });
  const confirmation = Promise.withResolvers<void>();
  loads.write(append(1), confirmation.promise);
  confirmation.reject(new Error("refused"));
  await confirmation.promise.catch(() => {});
  fetched.resolve([]);
  expect((await load).value).toEqual([]);
});

it("keeps applying a confirmed write to a load already in flight", async () => {
  const client = new QueryClient();
  const loads = loadsOf(client);
  const fetched = Promise.withResolvers<number[]>();
  const load = loads.load({
    signal: new AbortController().signal,
    fetch: () => fetched.promise,
  });
  const confirmation = Promise.withResolvers<void>();
  loads.write(append(1), confirmation.promise);
  confirmation.resolve();
  await confirmation.promise;
  fetched.resolve([]);
  expect((await load).value).toEqual([1]);
});
