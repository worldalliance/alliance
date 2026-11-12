import type { KeyboardEvent, MouseEvent } from "react";

/** For a button that takes the place of the one the user pressed, where the rest of that press would land: a double-click's second click, or a held Enter's repeats. */
export const pressOnce = (onPress: () => void) => ({
  onClick: (event: Pick<MouseEvent, "detail">) => {
    // Keyboard activation reports a detail of 0.
    if (event.detail <= 1) onPress();
  },
  onKeyDown: (
    event: Pick<KeyboardEvent, "key" | "repeat" | "preventDefault">,
  ) => {
    // A held Space activates once, on keyup, and a repeated Tab still has to move focus.
    if (event.repeat && event.key === "Enter") event.preventDefault();
  },
});
