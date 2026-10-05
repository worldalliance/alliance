import { cleanup, renderHook } from "@testing-library/react";
import { millisecondsInDay } from "date-fns/constants";
import type { UserAwayRangeDto } from "../client";
import { useAwayRanges } from "./useAwayRanges";

afterEach(cleanup);

const awayRange = (id: number, startDays: number, endDays: number) =>
  ({
    id,
    startDate: new Date(
      Date.now() + startDays * millisecondsInDay,
    ).toISOString(),
    endDate: new Date(Date.now() + endDays * millisecondsInDay).toISOString(),
    createdAt: new Date().toISOString(),
    reason: "vacation",
    note: null,
  }) satisfies UserAwayRangeDto;

describe("useAwayRanges", () => {
  it("finds the current range and keeps current and upcoming ones", () => {
    const past = awayRange(1, -10, -5);
    const current = awayRange(2, -1, 1);
    const upcoming = awayRange(3, 5, 10);

    const { result } = renderHook(() =>
      useAwayRanges([upcoming, past, current]),
    );

    expect(result.current.currentAwayRange).toBe(current);
    expect(result.current.upcomingOrCurrentAwayRanges).toEqual([
      current,
      upcoming,
    ]);
  });

  it("has no current range when none covers now", () => {
    const { result } = renderHook(() =>
      useAwayRanges([awayRange(1, -10, -5), awayRange(2, 5, 10)]),
    );

    expect(result.current.currentAwayRange).toBeNull();
  });
});
