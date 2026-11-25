/** Focuses the element on mount only while focus is on the page body, as after the pressed button was replaced, so it never takes focus from a control still on screen. */
export const focusIfLost = (element: HTMLElement | null) => {
  if (element && document.activeElement === document.body) element.focus();
};
