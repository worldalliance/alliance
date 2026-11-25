import { type RefObject, useCallback, useEffect, useId, useState } from "react";

type Focusable = { focus: () => void };

/**
 * Moves focus after a row's own control removes the row: to the first button
 * of the next row, else of the previous row, else to `fallback` (the list's
 * add control, or its `SearchField` when it has none).
 *
 * Spread `row(id)` on each row. Call `removing(id)` while the row is still
 * listed, and call what it returns once the row is to go.
 */
export function useFocusAfterRemoval<Id extends string | number>({
  ids,
  fallback,
}: {
  /** The rows on screen, in order. */
  ids: readonly Id[];
  fallback: RefObject<Focusable | null>;
}) {
  const scope = useId();
  const [pending, setPending] = useState<{ neighbour: Id | undefined } | null>(
    null,
  );

  useEffect(() => {
    if (pending === null) return;
    const { neighbour } = pending;
    const row = [
      ...document.querySelectorAll<HTMLElement>("[data-focus-row]"),
    ].find((element) => element.dataset.focusRow === `${scope}/${neighbour}`);
    const target = row?.querySelector<HTMLElement>("button");
    // A neighbour still listed but not yet rendered is waited for.
    if (!target && neighbour !== undefined && ids.includes(neighbour)) return;
    (target ?? fallback.current)?.focus();
    setPending(null);
  }, [pending, ids, scope, fallback]);

  const row = useCallback(
    (id: Id) => ({ "data-focus-row": `${scope}/${id}` }),
    [scope],
  );
  const removing = (id: Id) => {
    const index = ids.indexOf(id);
    const neighbour = ids[index + 1] ?? ids[index - 1];
    return () => setPending({ neighbour });
  };
  return { row, removing };
}
