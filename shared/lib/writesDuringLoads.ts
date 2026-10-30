import {
  hashKey,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

type Update<T> = (prev: T) => T;

/** A load may read the server before a write lands, so each write recorded
 * while a query loads is replayed over that load's result, after `replay`. */
export function writesDuringLoads<T>() {
  const pendingByClient = new WeakMap<
    QueryClient,
    Map<string, Set<Update<T>[]>>
  >();

  const load = async (params: {
    queryClient: QueryClient;
    queryKey: QueryKey;
    fetch: () => Promise<T>;
    replay?: Update<T>[];
  }): Promise<T> => {
    const byKey =
      pendingByClient.get(params.queryClient) ??
      new Map<string, Set<Update<T>[]>>();
    pendingByClient.set(params.queryClient, byKey);
    const hash = hashKey(params.queryKey);
    const pending = byKey.get(hash) ?? new Set<Update<T>[]>();
    byKey.set(hash, pending);
    const writes: Update<T>[] = [...(params.replay ?? [])];
    pending.add(writes);
    try {
      const loaded = await params.fetch();
      return writes.reduce<T>((value, update) => update(value), loaded);
    } finally {
      pending.delete(writes);
      if (pending.size === 0) byKey.delete(hash);
    }
  };

  const record = (params: {
    queryClient: QueryClient;
    queryKey: QueryKey;
    update: Update<T>;
  }) => {
    const pending = pendingByClient
      .get(params.queryClient)
      ?.get(hashKey(params.queryKey));
    for (const writes of pending ?? []) writes.push(params.update);
  };

  return { load, record };
}
