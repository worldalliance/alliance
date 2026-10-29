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
