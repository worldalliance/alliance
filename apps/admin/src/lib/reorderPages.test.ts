import { reorderPages } from "./reorderPages";
import { DropPosition } from "./useDragReorder";

const pages = ["a", "b", "c", "d"];

describe("reorderPages", () => {
  it("moves a page forward to either side of the drop target", () => {
    expect(
      reorderPages({
        pages,
        draggedIndex: 0,
        dropIndex: 2,
        position: DropPosition.Before,
        selectedIndex: 3,
      }),
    ).toEqual({ pages: ["b", "a", "c", "d"], selectedIndex: 3 });
    expect(
      reorderPages({
        pages,
        draggedIndex: 0,
        dropIndex: 2,
        position: DropPosition.After,
        selectedIndex: 3,
      }),
    ).toEqual({ pages: ["b", "c", "a", "d"], selectedIndex: 3 });
  });

  it("moves a page backward to either side of the drop target", () => {
    expect(
      reorderPages({
        pages,
        draggedIndex: 3,
        dropIndex: 1,
        position: DropPosition.Before,
        selectedIndex: 0,
      }),
    ).toEqual({ pages: ["a", "d", "b", "c"], selectedIndex: 0 });
    expect(
      reorderPages({
        pages,
        draggedIndex: 3,
        dropIndex: 1,
        position: DropPosition.After,
        selectedIndex: 0,
      }),
    ).toEqual({ pages: ["a", "b", "d", "c"], selectedIndex: 0 });
  });

  it("is null when the page would land where it started", () => {
    expect(
      reorderPages({
        pages,
        draggedIndex: 1,
        dropIndex: 2,
        position: DropPosition.Before,
        selectedIndex: 0,
      }),
    ).toBeNull();
    expect(
      reorderPages({
        pages,
        draggedIndex: 1,
        dropIndex: 0,
        position: DropPosition.After,
        selectedIndex: 0,
      }),
    ).toBeNull();
  });

  it("keeps the selection on the same page", () => {
    const move = (
      selectedIndex: number,
      draggedIndex: number,
      dropIndex: number,
    ) =>
      reorderPages({
        pages,
        draggedIndex,
        dropIndex,
        position: DropPosition.After,
        selectedIndex,
      })!;

    const dragged = move(1, 1, 3);
    expect(dragged.pages[dragged.selectedIndex]).toBe("b");

    const shiftedBack = move(2, 0, 3);
    expect(shiftedBack.pages[shiftedBack.selectedIndex]).toBe("c");

    const shiftedForward = move(1, 3, 0);
    expect(shiftedForward.pages[shiftedForward.selectedIndex]).toBe("b");

    const untouched = move(0, 1, 3);
    expect(untouched.selectedIndex).toBe(0);
  });
});
