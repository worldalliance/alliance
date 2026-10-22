import { type DropPosition, moveItem } from "./useDragReorder";

/**
 * Moves the page at `draggedIndex` to the `position` side of `dropIndex`, and
 * follows the selected page to wherever it ends up. Null when the move leaves
 * the page where it was.
 */
export function reorderPages<Page>(params: {
  pages: Page[];
  draggedIndex: number;
  dropIndex: number;
  position: DropPosition;
  selectedIndex: number;
}): { pages: Page[]; selectedIndex: number } | null {
  const { pages, draggedIndex, dropIndex, position, selectedIndex } = params;

  const moved = moveItem({ items: pages, draggedIndex, dropIndex, position });
  if (!moved) {
    return null;
  }
  const { insertionIndex } = moved;

  let newSelectedIndex = selectedIndex;
  if (selectedIndex === draggedIndex) {
    newSelectedIndex = insertionIndex;
  } else if (selectedIndex > draggedIndex && selectedIndex <= insertionIndex) {
    newSelectedIndex = selectedIndex - 1;
  } else if (selectedIndex < draggedIndex && selectedIndex >= insertionIndex) {
    newSelectedIndex = selectedIndex + 1;
  }

  return { pages: moved.items, selectedIndex: newSelectedIndex };
}
