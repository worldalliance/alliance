import { cn } from "@alliance/shared/styles/util";
import { heroNotifications } from "../content";
import { useRotation } from "../hooks";
import { NotificationCard } from "./NotificationCard";

/**
 * One card at a time. The outgoing card lifts and fades while the incoming one
 * rises into its place, so the swap reads as a single motion.
 */
export function NotificationRotator({
  className,
  bare = false,
  onDark = false,
}: {
  className?: string;
  bare?: boolean;
  onDark?: boolean;
}) {
  const active = useRotation(heroNotifications.length, 3600);

  return (
    <div className={cn("relative h-[62px] w-full max-w-[34rem]", className)}>
      {heroNotifications.map((notification, i) => {
        const isActive = i === active;
        return (
          <div
            key={notification.id}
            // The outgoing card clears out before the next fades in, so the two
            // never double-expose over the photo.
            className="absolute inset-x-0 top-0 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? "translateY(0)" : "translateY(10px)",
              zIndex: isActive ? 2 : 1,
              transitionProperty: "opacity, transform",
              transitionDuration: isActive ? "520ms" : "260ms",
              transitionDelay: isActive ? "300ms" : "0ms",
            }}
          >
            <NotificationCard
              notification={notification}
              bare={bare}
              onDark={onDark}
            />
          </div>
        );
      })}
    </div>
  );
}
