import { createEvent, fireEvent } from "@testing-library/react";

/**
 * Fires dragover at `clientY`, which the test DOM drops from a drag event's
 * init. The test DOM lays every element out at zero size, so -1 is above an
 * element's midpoint and 1 below. False when a listener cancels it, as a
 * drop target does to accept the drop.
 */
export const dragOverAt = (element: Element, clientY: number) => {
  const event = createEvent.dragOver(element, { dataTransfer: {} });
  Object.defineProperty(event, "clientY", { value: clientY });
  return fireEvent(element, event);
};
