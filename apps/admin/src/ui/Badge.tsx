import { PropsWithChildren } from "react";
import { cn } from "./cn";

export enum BadgeTone {
  Neutral = "neutral",
  Accent = "accent",
  Success = "success",
  Warning = "warning",
  Danger = "danger",
  Info = "info",
}

/** For a pre-redesign pill that can't render `Badge` yet. */
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  [BadgeTone.Neutral]:
    "bg-surface-2 text-fg-muted inset-ring inset-ring-line-strong",
  [BadgeTone.Accent]: "bg-accent-soft text-accent",
  [BadgeTone.Success]: "bg-success-soft text-success",
  [BadgeTone.Warning]: "bg-warning-soft text-warning",
  [BadgeTone.Danger]: "bg-danger-soft text-danger",
  [BadgeTone.Info]: "bg-info-soft text-info",
};

interface BadgeProps extends PropsWithChildren {
  className?: string;
  tone?: BadgeTone;
}

/** A status always carries its label here: the tone is never the only signal. */
const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  tone = BadgeTone.Neutral,
}: BadgeProps) => (
  <span
    className={cn(
      "inline-flex h-5 items-center gap-1 self-start rounded-full px-2 text-caption font-medium whitespace-nowrap",
      BADGE_TONE_CLASS[tone],
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
