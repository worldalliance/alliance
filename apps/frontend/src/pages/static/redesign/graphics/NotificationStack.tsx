import { cn } from "@alliance/shared/styles/util";
import { heroNotifications } from "../content";
import { useRotation } from "../hooks";
import { NotificationCard } from "./NotificationCard";

const OFFSET = 12;
const SCALE_STEP = 0.028;
const CARD_H = 66;
const VISIBLE = 5;

/** Overshoots slightly on the way in, so the cards settle like a real deck. */
const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/**
 * The version 4 hero. The front card carries the content and the ones behind
 * are blank shells stepping back in scale. On each tick the front card falls
 * away and rotates out while the rest advance into its place.
 */
export function NotificationStack({ className }: { className?: string }) {
  const total = heroNotifications.length;
  const front = useRotation(total, 3200);

  return (
    <div
      className={cn("relative w-[340px] sm:w-[560px]", className)}
      style={{ height: CARD_H + OFFSET * (VISIBLE - 1) }}
      aria-label="Recent member activity"
    >
      {heroNotifications.map((notification, i) => {
        const depth = (i - front + total) % total;
        const leaving = depth === total - 1;
        const hidden = depth >= VISIBLE && !leaving;

        return (
          <div
            key={notification.id}
            className="absolute inset-x-0 bottom-0 origin-bottom"
            style={{
              transform: leaving
                ? `translateY(${OFFSET * 2.2}px) scale(1.015)`
                : `translateY(${-depth * OFFSET}px) scale(${1 - depth * SCALE_STEP})`,
              opacity: leaving || hidden ? 0 : 1,
              zIndex: total - depth,
              transition: `transform 760ms ${SPRING}, opacity ${leaving ? 420 : 620}ms ease-out`,
            }}
          >
            {depth === 0 ? (
              <NotificationCard notification={notification} showPhoto />
            ) : (
              <div
                className="border border-[var(--rd-ink)]/25 bg-white shadow-[0_6px_20px_-12px_rgba(0,0,0,0.35)]"
                style={{
                  height: CARD_H,
                  borderRadius: "var(--rd-radius-input)",
                }}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
