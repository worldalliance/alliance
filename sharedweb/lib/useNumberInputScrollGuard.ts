import { useEffect } from "react";

/**
 * Wheel events over a focused `<input type="number">` change its value, which
 * users hit by accident while scrolling. Blurring the input in the capture
 * phase drops the value change while still letting the page scroll.
 */
export const useNumberInputScrollGuard = () => {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        active.type === "number" &&
        active === event.target
      ) {
        active.blur();
      }
    };

    document.addEventListener("wheel", handleWheel, { capture: true });
    return () => {
      document.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);
};
