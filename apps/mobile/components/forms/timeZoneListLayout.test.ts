import { timeZoneListWindow } from "./timeZoneListLayout";

const ROWS = 50;

function lastRowBottom({
  rowSpan,
  maxHeight,
}: {
  rowSpan: number;
  maxHeight: number;
}) {
  const { height, firstRow } = timeZoneListWindow({
    selectedIndex: ROWS - 1,
    rowCount: ROWS,
    rowSpan,
    maxHeight,
  });
  return { height, bottom: (ROWS - firstRow) * rowSpan };
}

describe("timeZoneListWindow", () => {
  test("opens with the saved zone second from the top", () => {
    expect(
      timeZoneListWindow({
        selectedIndex: 20,
        rowCount: ROWS,
        rowSpan: 70,
        maxHeight: 420,
      }).firstRow,
    ).toBe(19);
  });

  test("opens at the top for the first zone or one not in the list", () => {
    for (const selectedIndex of [0, -1]) {
      expect(
        timeZoneListWindow({
          selectedIndex,
          rowCount: ROWS,
          rowSpan: 70,
          maxHeight: 420,
        }).firstRow,
      ).toBe(0);
    }
  });

  test("opens at the top when every row fits", () => {
    expect(
      timeZoneListWindow({
        selectedIndex: 3,
        rowCount: 4,
        rowSpan: 70,
        maxHeight: 420,
      }).firstRow,
    ).toBe(0);
  });

  test("keeps a row on show when one row is taller than the list", () => {
    expect(
      timeZoneListWindow({
        selectedIndex: 3,
        rowCount: ROWS,
        rowSpan: 500,
        maxHeight: 420,
      }),
    ).toEqual({ height: 500, firstRow: 2 });
  });

  test.each([62, 63, 68, 70, 76, 81, 104, 163])(
    "puts the last row at the bottom with a %ipx row span",
    (rowSpan) => {
      const { height, bottom } = lastRowBottom({ rowSpan, maxHeight: 420 });
      expect(bottom).toBe(height);
      expect(height).toBeLessThanOrEqual(420);
    },
  );
});
