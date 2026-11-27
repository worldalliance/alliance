import { useState } from "react";

const KEY = "builder.outlineHidden";

/** Below this the outline starts hidden, so the canvas keeps a member's width. */
const NARROW = "(max-width: 1023px)";

function storedHidden(): boolean {
  const stored = localStorage.getItem(KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia(NARROW).matches;
}

/** Whether the outline pane is hidden, remembered in this browser. */
export function useOutlineHidden() {
  const [hidden, setHidden] = useState(storedHidden);
  return {
    hidden,
    toggle: () => {
      localStorage.setItem(KEY, String(!hidden));
      setHidden(!hidden);
    },
  };
}
