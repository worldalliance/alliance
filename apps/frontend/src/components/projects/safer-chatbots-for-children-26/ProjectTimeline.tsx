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
    <section className={cn("flex flex-col gap-6 lg:gap-10", className)}>
      <h2 className="site-sans text-center text-xl font-medium text-[var(--site-ink)] sm:text-2xl">
        {TIMELINE_HEADING}
      </h2>
      <ol
        className="site-sans relative flex flex-col gap-6 text-base lg:grid lg:gap-x-8 lg:before:absolute lg:before:top-[7px] lg:before:right-0 lg:before:left-0 lg:before:h-0.5 lg:before:bg-[var(--site-ink)]/25"
        style={{
          gridTemplateColumns: `repeat(${PHASES.length}, minmax(0, 1fr))`,
        }}
      >
        {PHASES.map((phase, idx) => {
          const current = idx === currentIdx;
          const last = idx === PHASES.length - 1;
          return (
            <li
              key={phase.label}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3.5 lg:flex-col lg:gap-3"
            >
              <div className="flex h-5 shrink-0 items-center lg:h-4">
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-sm ring-4 ring-white lg:size-4",
                    current ? "bg-green" : "bg-zinc-400",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-5 -bottom-6 left-[4.75px] w-0.5 bg-[var(--site-ink)]/25 lg:hidden"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-left">
                <p
                  className={cn(
                    "font-semibold",
                    current ? "text-green" : "text-[var(--site-ink)]/70",
                  )}
                >
                  {phase.label}
                </p>
                <div className="aspect-[4/3] w-full max-w-xs overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3 lg:max-w-none">
                  <PictureSlot
                    src={phase.imageSrc}
                    className="size-full rounded-sm object-contain"
                  />
                </div>
                <p className="leading-snug text-[var(--site-ink)]">
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
