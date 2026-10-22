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
    <section
      className={cn(
        "flex flex-col gap-6 lg:gap-10 lg:[container-type:inline-size]",
        className,
      )}
    >
      <h2 className="site-sans text-center text-xl font-semibold text-[var(--site-ink)] sm:text-2xl">
        {TIMELINE_HEADING}
      </h2>
      <ol className="site-sans relative flex flex-col gap-4 text-base lg:mx-[min(5rem,6cqw)] lg:grid lg:grid-cols-[repeat(2,minmax(0,1fr))_0] lg:gap-0 lg:before:absolute lg:before:top-[5px] lg:before:right-0 lg:before:left-0 lg:before:h-0.5 lg:before:bg-[var(--site-ink)]/25">
        {PHASES.map((phase, idx) => {
          const current = idx === currentIdx;
          const last = idx === PHASES.length - 1;
          return (
            <li
              key={phase.label}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3.5 lg:flex-col lg:items-start lg:gap-3 lg:text-center"
            >
              <div className="flex h-5 items-center gap-1 lg:h-auto lg:-translate-x-1/2">
                <span
                  className={cn(
                    "size-3 lg:size-4 shrink-0 rounded-sm ring-4 ring-white",
                    current ? "bg-green" : "bg-zinc-400",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-5 -bottom-3 left-[4.75px] w-0.5 bg-[var(--site-ink)]/25 lg:hidden"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 lg:hidden">
                <p>
                  <span
                    className={cn("font-semibold", current && "text-green")}
                  >
                    {phase.description}
                  </span>{" "}
                  <span className="text-[var(--site-ink)]/70">
                    {phase.label}
                  </span>
                </p>
                <PictureSlot src={phase.imageSrc} className="h-16 w-24" />
              </div>
              <div className="hidden lg:flex lg:w-[min(10rem,12cqw)] lg:shrink-0 lg:-translate-x-1/2 lg:flex-col lg:items-center">
                <p className="text-[var(--site-ink)]/70">{phase.label}</p>
                <p className={cn("font-semibold", current && "text-green")}>
                  {phase.description}
                </p>
                <PictureSlot
                  src={phase.imageSrc}
                  className="mt-3 aspect-[3/2] w-full"
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
