import type { SetURLSearchParams } from "react-router";

/** Removes a link's one-shot parameters without a history entry, so a reload doesn't apply them again. */
export const dropSearchParams = (
  setSearchParams: SetURLSearchParams,
  names: readonly string[],
) =>
  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev);
      for (const name of names) next.delete(name);
      return next;
    },
    { replace: true },
  );
