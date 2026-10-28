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
        className="site-sans relative flex flex-col gap-6 text-lg lg:grid lg:grid-rows-[auto_auto_auto] lg:gap-x-8"
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
              className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 lg:row-span-3 lg:grid-cols-1 lg:grid-rows-subgrid lg:gap-3"
            >
              <div className="relative col-start-1 row-start-1 lg:hidden">
                {idx > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-0 -bottom-[14px] left-[5px] w-0.5 bg-[var(--site-ink)]/25"
                  />
                )}
              </div>
              <div className="col-start-2 row-start-1 aspect-square w-full max-w-xs overflow-hidden rounded-md lg:col-start-1 lg:max-w-none">
                <PictureSlot src={phase.imageSrc} className="size-full" />
              </div>
              <div className="relative col-start-1 row-start-2 flex lg:row-start-2 lg:h-4 lg:items-center">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-0 hidden h-0.5 -translate-y-1/2 bg-[var(--site-ink)]/25 lg:block",
                    last ? "right-0" : "-right-8",
                  )}
                />
                <span
                  className={cn(
                    "relative mt-1.5 size-3 shrink-0 rounded-sm ring-4 ring-white lg:mt-0 lg:size-4",
                    current ? "bg-green" : "bg-zinc-400",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 -bottom-6 left-[5px] w-0.5 bg-[var(--site-ink)]/25 lg:hidden"
                  />
                )}
              </div>
              <p className="col-start-2 row-start-2 text-left leading-snug font-medium text-[var(--site-ink)] lg:col-start-1 lg:row-start-3">
                {phase.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
