export function isAwayRangeActiveAt(
  range: { startDate: Date; endDate: Date },
  date: Date,
): boolean {
  return range.startDate <= date && date < range.endDate;
}
