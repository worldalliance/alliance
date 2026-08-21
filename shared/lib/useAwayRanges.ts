import { useMemo } from "react";
import type { UserAwayRangeDto } from "../client";

export function useAwayRanges(awayRanges: UserAwayRangeDto[] | undefined) {
  const sortedAwayRanges = useMemo(() => {
    if (!awayRanges?.length) return [];
    return [...awayRanges].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [awayRanges]);

  const currentAwayRange = useMemo(() => {
    const now = new Date();
    return (
      sortedAwayRanges.find((range) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        return start <= now && now <= end;
      }) ?? null
    );
  }, [sortedAwayRanges]);

  const upcomingOrCurrentAwayRanges = useMemo(() => {
    const now = new Date();
    return sortedAwayRanges.filter((range) => new Date(range.endDate) >= now);
  }, [sortedAwayRanges]);

  return {
    sortedAwayRanges,
    currentAwayRange,
    upcomingOrCurrentAwayRanges,
  };
}
