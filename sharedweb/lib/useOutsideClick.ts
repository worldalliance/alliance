import { useEffect, useRef } from "react";

export const useOutsideClick = (onClickOutside: () => void) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // composedPath, not contains: React can detach the clicked node — an icon
      // swapped on click — before this listener runs, and a detached node is
      // contained by nothing.
      if (ref.current && !event.composedPath().includes(ref.current)) {
        onClickOutside();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [ref, onClickOutside]);

  return ref;
};
