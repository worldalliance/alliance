import type { KeyboardEvent, MouseEvent } from "react";

// Windows' default double-click time. Users can lengthen the OS interval to seconds, where a deliberate press on the replacing button would otherwise be dropped.
const leftoverClickMs = 500;
let clickedAt = -Infinity;

/** For a button that takes the place of the one the user pressed, where the rest of that press would land: a double-click's second click, or a held Enter's repeats. The replaced button must use pressOnce too, since only pressOnce records the click the window counts from. */
export const pressOnce = (onPress: () => void) => ({
  onClick: (
    event: Pick<MouseEvent, "detail" | "timeStamp" | "preventDefault">,
  ) => {
    // Keyboard activation reports a detail of 0. Each click restarts the window, as the OS's own count does, so a triple-click's third click is left over too.
    const leftover =
      event.detail > 1 && event.timeStamp - clickedAt < leftoverClickMs;
    clickedAt = event.timeStamp;
    // A submit button's leftover click would still submit its form.
    if (leftover) event.preventDefault();
    else onPress();
  },
  onKeyDown: (
    event: Pick<KeyboardEvent, "key" | "repeat" | "preventDefault">,
  ) => {
    // A held Space activates once, on keyup, and a repeated Tab still has to move focus.
    if (event.repeat && event.key === "Enter") event.preventDefault();
  },
});
