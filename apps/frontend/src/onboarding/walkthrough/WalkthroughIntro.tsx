import { cn } from "@alliance/shared/styles/util";
import { useEffect, useRef, useState } from "react";
import { PANEL_FADE_MS } from "../joinPhase";

export function WalkthroughIntro({ onDone }: { onDone: () => void }) {
  const [hidden, setHidden] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setHidden(true));
    });
    const fallback = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onDone();
    }, PANEL_FADE_MS + 50);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(fallback);
    };
  }, [onDone]);

  return (
    <div
      data-tour-intro
      className={cn(
        "pointer-events-auto absolute inset-0 z-20 bg-white transition-opacity",
        hidden && "opacity-0",
      )}
      style={{ transitionDuration: `${PANEL_FADE_MS}ms` }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) finish();
      }}
    />
  );
}
