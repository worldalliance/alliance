import { useMemo } from "react";
import type { UserAwayRangeDto } from "../client";
import { AwayRangeStatus, awayRangeStatus } from "./awayRangesFormatters";

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
      sortedAwayRanges.find(
        (range) => awayRangeStatus(range, now) === AwayRangeStatus.Current,
      ) ?? null
    );
  }, [sortedAwayRanges]);

  const upcomingOrCurrentAwayRanges = useMemo(() => {
    const now = new Date();
    return sortedAwayRanges.filter(
      (range) => awayRangeStatus(range, now) !== AwayRangeStatus.Past,
    );
  }, [sortedAwayRanges]);

  return {
    sortedAwayRanges,
    currentAwayRange,
    upcomingOrCurrentAwayRanges,
  };
}
