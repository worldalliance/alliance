import { cn } from "@alliance/shared/styles/util";

export enum ProgressTrackSize {
  /** A page's headline progress, which grows on wider screens. */
  Page = "page",
  /** Inside a card, where it stays at the phone height. */
  Card = "card",
}

const heightClasses: Record<ProgressTrackSize, string> = {
  [ProgressTrackSize.Page]: "h-3 sm:h-6",
  [ProgressTrackSize.Card]: "h-3",
};

export type ProgressSegment = { count: number; className: string };

/**
 * Segments fill left to right, each capped at what the earlier ones leave of
 * the goal. Without a `label` the track is decorative, for a count spelled out
 * beside it.
 */
export function ProgressTrack({
  goal,
  segments,
  size,
  label,
  className,
}: {
  goal: number;
  segments: ProgressSegment[];
  size: ProgressTrackSize;
  label?: string;
  className?: string;
}) {
  let used = 0;
  const widths = segments.map(({ count }) => {
    const share = Math.min(count, Math.max(0, goal - used));
    used += share;
    return `${(share / goal) * 100}%`;
  });
  return (
    <div
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-zinc-100",
        heightClasses[size],
        className,
      )}
    >
      {segments.map((segment, idx) => (
        <div
          key={idx}
          className={cn(
            "h-full",
            idx === segments.length - 1 && "rounded-r-full",
            segment.className,
          )}
          style={{ width: widths[idx] }}
        />
      ))}
    </div>
  );
}
