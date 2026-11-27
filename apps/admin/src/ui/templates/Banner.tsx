import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";

export enum BannerTone {
  /** A standing fact that changes what the page's actions mean. */
  Info = "info",
  /** A consequence to weigh before acting. */
  Warning = "warning",
  /** A violation or a blocker. */
  Danger = "danger",
}

const TONE: Record<BannerTone, { box: string; icon: string }> = {
  [BannerTone.Info]: { box: "bg-info-soft border-info", icon: "text-info" },
  [BannerTone.Warning]: {
    box: "bg-warning-soft border-warning",
    icon: "text-warning",
  },
  [BannerTone.Danger]: {
    box: "bg-danger-soft border-danger",
    icon: "text-danger",
  },
};

const ICON: Record<BannerTone, typeof Info> = {
  [BannerTone.Info]: Info,
  [BannerTone.Warning]: TriangleAlert,
  [BannerTone.Danger]: CircleAlert,
};

/**
 * A fact in words, led by an icon. As `Page`'s `banner` it runs edge to edge
 * under the tabs; with `inline` it is a box inside the body.
 */
export function Banner({
  tone = BannerTone.Info,
  inline = false,
  action,
  children,
}: {
  tone?: BannerTone;
  inline?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === BannerTone.Danger ? "alert" : "note"}
      className={cn(
        "flex shrink-0 items-start gap-2.5",
        TONE[tone].box,
        inline
          ? "rounded-card border px-card py-bar"
          : "border-b border-b-line px-page py-3",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", TONE[tone].icon)}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {/* Pulled into the text's first line, so a small button centres on it. */}
      {action && <div className="-my-1.5 shrink-0">{action}</div>}
    </div>
  );
}
