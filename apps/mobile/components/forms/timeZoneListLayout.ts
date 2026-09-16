// React Native doesn't clamp initialScrollIndex, and a list that isn't a whole
// number of rows tall has no index that puts the last row at the bottom.
export function timeZoneListWindow({
  selectedIndex,
  rowCount,
  rowSpan,
  maxHeight,
}: {
  selectedIndex: number;
  rowCount: number;
  rowSpan: number;
  maxHeight: number;
}): { height: number; firstRow: number } {
  const visibleRows = Math.max(Math.floor(maxHeight / rowSpan), 1);
  return {
    height: visibleRows * rowSpan,
    firstRow: Math.max(Math.min(selectedIndex - 1, rowCount - visibleRows), 0),
  };
}
