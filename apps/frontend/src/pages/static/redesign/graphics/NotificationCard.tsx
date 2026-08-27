import { cn } from "@alliance/shared/styles/util";
import { Check, Plus } from "lucide-react";
import { NotificationIcon, type HeroNotification } from "../content";

/** Fixed width so the name sits in the same place on every card. */
const AVATAR_COLUMN = "w-[76px]";
const AVATAR_STEP = 20;

/**
 * Overlapping avatars, right-aligned: the last one sits on top and fully
 * visible, closest to the text. Every image carries the same ring.
 */
function AvatarStack({ avatars }: { avatars: string[] }) {
  return (
    <div className={cn("relative h-9 shrink-0", AVATAR_COLUMN)} aria-hidden>
      {avatars.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="absolute top-0 size-9 rounded-[5px] object-cover ring-2 ring-white"
          style={{ left: i * AVATAR_STEP, zIndex: i + 1 }}
        />
      ))}
    </div>
  );
}

const iconByKind: Record<NotificationIcon, typeof Check> = {
  [NotificationIcon.Check]: Check,
  [NotificationIcon.Plus]: Plus,
};

/**
 * `bare` drops the card chrome so the group sits directly on the page, which is
 * where `onDark` comes in: over a photo the type has to invert.
 */
export function NotificationCard({
  notification,
  className,
  bare = false,
  onDark = false,
  showPhoto = false,
}: {
  notification: HeroNotification;
  className?: string;
  bare?: boolean;
  onDark?: boolean;
  showPhoto?: boolean;
}) {
  const Icon = iconByKind[notification.icon];

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 px-3 py-2.5",
        !bare &&
          "border border-[var(--rd-ink)]/25 bg-white shadow-[0_6px_20px_-10px_rgba(0,0,0,0.3)]",
        className,
      )}
      style={bare ? undefined : { borderRadius: "var(--rd-radius-input)" }}
    >
      <AvatarStack avatars={notification.avatars} />
      <div className="min-w-0 flex-1 leading-snug">
        <p
          className={cn(
            "truncate text-sm",
            onDark
              ? "text-white/85 [text-shadow:0_1px_5px_rgba(0,0,0,0.8)]"
              : "text-[var(--rd-ink)]/65",
          )}
        >
          {notification.othersCount > 0
            ? `${notification.name} and ${notification.othersCount} others`
            : notification.name}
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-[0.95rem] font-medium",
            onDark
              ? "text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.8)]"
              : "text-[var(--rd-ink)]",
          )}
        >
          <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className={bare ? undefined : "truncate"}>
            {notification.action}
          </span>
        </p>
      </div>
      {showPhoto && notification.photo && (
        <img
          src={notification.photo}
          alt=""
          aria-hidden
          className="hidden h-11 w-14 shrink-0 rounded-[5px] object-cover sm:block"
        />
      )}
    </div>
  );
}
