import type { ActionUpdateDto } from "@alliance/shared/client";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import { cn } from "@alliance/shared/styles/util";
import { useMemo, useRef } from "react";
import HomeUpdateCard from "./HomeUpdateCard";
import HomeUpdatesSection from "./HomeUpdatesSection";

const SWIPE_THRESHOLD_PX = 50;
const CARD_WIDTH = "82%";
const CARD_GAP = "0.75rem";

function Carousel({
  updates,
  isNew,
  markOpened,
}: {
  updates: ActionUpdateDto[];
  isNew: (updateId: number) => boolean;
  markOpened: (updateId: number) => void;
}) {
  const keys = useMemo(() => updates.map((u) => String(u.id)), [updates]);
  const { index, setIndex, goNext, goPrev, hasMultiple } =
    useBoundedIndex(keys);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy))
      return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <div aria-roledescription="carousel" className="flex flex-col gap-3">
      <div
        className="overflow-hidden touch-pan-y"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <div
          aria-live="polite"
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            gap: CARD_GAP,
            transform: `translateX(calc(-${index} * (${CARD_WIDTH} + ${CARD_GAP})))`,
          }}
        >
          {updates.map((update, position) => (
            <div
              key={update.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${updates.length}`}
              inert={position !== index}
              className="shrink-0"
              style={{ width: CARD_WIDTH }}
            >
              <HomeUpdateCard
                update={update}
                isNew={isNew(update.id)}
                onOpen={markOpened}
              />
            </div>
          ))}
        </div>
      </div>

      {hasMultiple && (
        <div className="flex items-center justify-center">
          {updates.map((update, position) => (
            <button
              key={update.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show update ${position + 1} of ${updates.length}`}
              aria-current={position === index ? "true" : undefined}
              className="flex size-6 cursor-pointer items-center justify-center"
            >
              <span
                className={cn(
                  "h-2 rounded-full transition-all duration-150 motion-reduce:transition-none",
                  position === index ? "w-5 bg-zinc-700" : "w-2 bg-zinc-300",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeUpdatesCarousel() {
  return (
    <HomeUpdatesSection>
      {(params) => <Carousel {...params} />}
    </HomeUpdatesSection>
  );
}
