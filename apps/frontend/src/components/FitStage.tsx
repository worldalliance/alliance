import { cn } from "@alliance/shared/styles/util";
import type { StyleWithVars } from "@alliance/sharedweb/ui/cssVars";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./fitStage.css";

type FitSize = { width: number; height: number };

// Measured directly rather than via a CSS container-query calc(), since
// container-query unit support is uneven enough across mobile engines
// (Firefox for Android in particular) that a feature-detected CSS fallback
// isn't reliable. Reads the layout box rather than `getBoundingClientRect`,
// so an ancestor mid transform does not feed its own scale back in.
function useFitScale({ width, height }: FitSize) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      setScale(
        Math.min(element.clientWidth / width, element.clientHeight / height),
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height]);

  return { ref, scale };
}

/**
 * Scales a box authored at a fixed pixel size to fit the space it is given, by
 * whichever axis runs out first, so nothing is ever cropped.
 */
export function FitStage({
  width,
  height,
  className,
  children,
}: FitSize & { className?: string; children: ReactNode }) {
  const { ref, scale } = useFitScale({ width, height });

  const style: StyleWithVars = {
    width,
    height,
    ...(scale !== null && { "--fit-scale": scale }),
  };

  return (
    <div ref={ref} className={cn("fit-stage", className)}>
      <div className="fit-stage__box" style={style}>
        {children}
      </div>
    </div>
  );
}
