import {
  CancelledError,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { writesDuringLoads } from "./writesDuringLoads";

type Session = { id: number; clears: (() => void)[] };
const sessions = new WeakMap<QueryClient, Session>();

function sessionOf(queryClient: QueryClient) {
  let session = sessions.get(queryClient);
  if (!session) {
    session = { id: 0, clears: [] };
    sessions.set(queryClient, session);
  }
  return session;
}

/** Callers capture this when a write starts; a store drops the write if the session has changed by the time it applies. */
export const currentSession = (queryClient: QueryClient) =>
  sessionOf(queryClient).id;

/** Clears every `sessionStore` of this client; its records belong to the viewer that loaded them. */
export function endSession(queryClient: QueryClient) {
  const session = sessionOf(queryClient);
  session.id++;
  for (const clear of session.clears) clear();
}

/** `clear` stays off the returned store so `endSession` is the only reset. */
export function sessionStore<S extends { clear: () => void }>(
  create: (queryClient: QueryClient) => S,
): (queryClient: QueryClient) => Omit<S, "clear"> {
  const stores = new WeakMap<QueryClient, Omit<S, "clear">>();
  return (queryClient) => {
    const existing = stores.get(queryClient);
    if (existing) return existing;
    const { clear, ...store } = create(queryClient);
    stores.set(queryClient, store);
    sessionOf(queryClient).clears.push(clear);
    return store;
  };
}

type Update<T> = (value: T) => T;

/**
 * Loads of one query key, numbered by request start so the newest wins, and
 * cancelled once aborted or once their session ends. A write replays over the
 * loads in flight when it is made. Revisions compare only within one
 * instance, so a store routes every revision of its records through one.
 */
export function sessionLoads<T>(params: {
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  const { queryClient, queryKey } = params;
  const loads = writesDuringLoads<T>();
  let revision = 0;

  return {
    nextRevision: () => ++revision,
    write: (update: Update<T>) =>
      loads.record({ queryClient, queryKey, update }),
    load: async (load: {
      signal: AbortSignal;
      fetch: () => Promise<T>;
    }): Promise<{ value: T; revision: number }> => {
      const started = ++revision;
      const session = currentSession(queryClient);
      const value = await loads.load({
        queryClient,
        queryKey,
        fetch: load.fetch,
      });
      if (load.signal.aborted || session !== currentSession(queryClient)) {
        throw new CancelledError();
      }
      return { value, revision: started };
    },
  };
}
