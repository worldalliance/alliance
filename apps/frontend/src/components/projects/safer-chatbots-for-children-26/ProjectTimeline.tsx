import { cn } from "@alliance/shared/styles/util";
import { PHASES, TIMELINE_HEADING } from "./copy";
import { PictureSlot } from "./PictureSlot";

export function ProjectTimeline({
  currentIdx,
  className,
}: {
  currentIdx: number;
  className?: string;
}) {
  return (
    <section aria-label={TIMELINE_HEADING} className={className}>
      <ol
        className="site-sans relative flex flex-col gap-6 text-base lg:grid lg:grid-rows-[auto_auto_auto] lg:gap-x-8"
        style={{
          gridTemplateColumns: `repeat(${PHASES.length}, minmax(0, 1fr))`,
        }}
      >
        {PHASES.map((phase, idx) => {
          const current = idx === currentIdx;
          const last = idx === PHASES.length - 1;
          return (
            <li
              key={phase.description}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3.5 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-3"
            >
              <div className="flex shrink-0 lg:relative lg:row-start-2 lg:h-4 lg:items-center">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-0 hidden h-0.5 -translate-y-1/2 bg-[var(--site-ink)]/25 lg:block",
                    last ? "right-0" : "-right-8",
                  )}
                />
                <span
                  className={cn(
                    "relative size-3 shrink-0 rounded-sm ring-4 ring-white lg:size-4",
                    current ? "bg-green" : "bg-zinc-400",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-3 -bottom-6 left-[4.75px] w-0.5 bg-[var(--site-ink)]/25 lg:hidden"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-left lg:contents">
                <div className="aspect-square w-full max-w-xs overflow-hidden rounded-md lg:row-start-1 lg:max-w-none">
                  <PictureSlot src={phase.imageSrc} className="size-full" />
                </div>
                <p
                  className={cn(
                    "leading-snug lg:row-start-3",
                    current ? "text-green" : "text-[var(--site-ink)]",
                  )}
                >
                  {phase.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
