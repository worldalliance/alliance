import { cn } from "@alliance/shared/styles/util";
interface Phase {
  label: string;
  description: string;
}

const PHASES: Phase[] = [
  {
    label: "Preparation",
    description: "Alliance invites members to participate",
  },
  {
    label: "Week 1",
    description: "Members nominate nonprofits",
  },
  {
    label: "Week 2",
    description: "Experts analyze each nonprofit",
  },
  {
    label: "Week 3",
    description: "Members vote on nonprofits using analyses",
  },
  {
    label: "Week 4",
    description: "Experts select one from top-voted results",
  },
  {
    label: "Post-project",
    description: "Alliance sends $100k to selected nonprofit",
  },
];

export function ProjectTimeline({
  currentIdx,
  className,
}: {
  currentIdx: number;
  className?: string;
}) {
  return (
    <section
      className={cn("lg:[container-type:inline-size]", className)}
      aria-label="Timeline"
    >
      <ol className="site-sans relative flex flex-col gap-4 text-lg lg:mx-[min(5rem,6cqw)] lg:grid lg:grid-cols-[repeat(5,minmax(0,1fr))_0] lg:gap-0 lg:before:absolute lg:before:top-2.5 lg:before:-translate-y-1/2 lg:before:right-0 lg:before:left-0 lg:before:h-0.5 lg:before:bg-[var(--site-ink)]/25">
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
                    "size-4 lg:size-5 shrink-0 rounded-full ring-4 ring-white",
                    current ? "bg-green" : "bg-zinc-400",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-5 -bottom-3 left-2 w-0.5 -translate-x-1/2 bg-[var(--site-ink)]/25 lg:hidden"
                  />
                )}
              </div>
              <div className="lg:hidden">
                <p className={cn("font-semibold", current && "text-green")}>
                  {phase.description}
                </p>
                <p className="text-[var(--site-ink)]/70">{phase.label}</p>
              </div>
              <div className="hidden lg:block lg:w-[min(10rem,12cqw)] lg:shrink-0 lg:-translate-x-1/2">
                <p className="text-[var(--site-ink)]/70">{phase.label}</p>
                <p className={cn("font-semibold", current && "text-green")}>
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
