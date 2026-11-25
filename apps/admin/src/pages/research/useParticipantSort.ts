import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { ParticipantSort, SortDirection } from "../../lib/koraParticipants";

export type ParticipantSorting = {
  by: ParticipantSort;
  direction: SortDirection;
};

const DEFAULT: ParticipantSorting = {
  by: ParticipantSort.SignedUp,
  direction: SortDirection.Desc,
};

const PARAM = "sort";

/** `name` ascending, `-name` descending; anything else is the default. */
export const parseParticipantSort = (
  value: string | null,
): ParticipantSorting => {
  if (!value) return DEFAULT;
  const descending = value.startsWith("-");
  const column = descending ? value.slice(1) : value;
  const by = Object.values(ParticipantSort).find((c) => c === column);
  return by
    ? { by, direction: descending ? SortDirection.Desc : SortDirection.Asc }
    : DEFAULT;
};

export const nextParticipantSort = (
  current: ParticipantSorting,
  by: ParticipantSort,
): ParticipantSorting => ({
  by,
  direction:
    current.by === by && current.direction === SortDirection.Asc
      ? SortDirection.Desc
      : SortDirection.Asc,
});

/** The participants table's sort, kept in `?sort=`; newest signup first is the bare URL. */
export function useParticipantSort(): [
  ParticipantSorting,
  (by: ParticipantSort) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = parseParticipantSort(searchParams.get(PARAM));
  const toggle = useCallback(
    (by: ParticipantSort) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const { by: column, direction } = nextParticipantSort(
            parseParticipantSort(prev.get(PARAM)),
            by,
          );
          if (column === DEFAULT.by && direction === DEFAULT.direction) {
            next.delete(PARAM);
          } else {
            next.set(
              PARAM,
              direction === SortDirection.Desc ? `-${column}` : column,
            );
          }
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  return [sort, toggle];
}
