import { cn } from "@alliance/shared/styles/util";
import { useEffect, useState } from "react";

enum IntroPhase {
  /** The wordmark rises onto the white the panel left behind. */
  Logo = "logo",
  /** The white lifts off the platform. */
  Reveal = "reveal",
}

const PHASE_MS: Record<IntroPhase, number> = {
  [IntroPhase.Logo]: 340,
  [IntroPhase.Reveal]: 340,
};

/**
 * Carries the white the leaving panel uncovered, holds the wordmark on it, then
 * lifts off the platform. Also covers the tasks page fetching and the tour
 * scrolling to its first anchor.
 */
export function WalkthroughIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(IntroPhase.Logo);

  useEffect(() => {
    const timer = setTimeout(() => {
      switch (phase) {
        case IntroPhase.Logo:
          setPhase(IntroPhase.Reveal);
          return;
        case IntroPhase.Reveal:
          onDone();
          return;
        default:
          throw new Error(`unknown intro phase: ${phase satisfies never}`);
      }
    }, PHASE_MS[phase]);

    return () => clearTimeout(timer);
  }, [phase, onDone]);

  return (
    <div
      data-tour-intro
      className={cn(
        "pointer-events-auto absolute inset-0 z-20 bg-white transition-opacity",
        phase === IntroPhase.Reveal && "opacity-0",
      )}
      style={{ transitionDuration: `${PHASE_MS[IntroPhase.Reveal]}ms` }}
    >
      <p
        data-tour-intro-logo
        className="font-logotype ob-logo-rise absolute top-4 left-4 p-3 text-xl text-black"
      >
        The Alliance
      </p>
    </div>
  );
}
