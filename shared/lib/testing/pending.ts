export type Pending<T> = {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
};

/** A call that never settles on its own: the test picks it out of `queue` and
 * decides when and how it comes back. */
export const pending = <T>(queue: Pending<T>[], signal?: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    queue.push({ resolve, reject, signal });
  });
