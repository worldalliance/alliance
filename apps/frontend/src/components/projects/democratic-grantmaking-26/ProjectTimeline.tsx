import { cn } from "@alliance/shared/styles/util";
import { BandHeading, BandHeadingSize } from "../../../site/PageShell";

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
    description: "Members vote on nonprofits",
  },
  {
    label: "Week 4",
    description: "Experts select one from top results",
  },
  {
    label: "Post-Project",
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
    <section className={className} aria-label="Timeline">
      <BandHeading
        onDark
        size={BandHeadingSize.Section}
        className="mb-8 text-center lg:sr-only"
      >
        Timeline
      </BandHeading>
      <ol className="site-sans relative flex flex-col gap-4 text-sm lg:mx-[5.5px] lg:grid lg:grid-cols-[repeat(5,minmax(0,1fr))_0] lg:gap-0 lg:[container-type:inline-size] lg:before:absolute lg:before:top-[5.5px] lg:before:right-0 lg:before:left-0 lg:before:h-px lg:before:bg-white/35">
        {PHASES.map((phase, idx) => {
          const current = idx === currentIdx;
          const last = idx === PHASES.length - 1;
          return (
            <li
              key={phase.label}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3.5 lg:flex-col lg:items-start lg:gap-3 lg:text-center lg:first:text-left lg:last:text-right lg:first:[&>div:last-child]:-ml-[5.5px] lg:first:[&>div:last-child]:translate-x-0 lg:last:[&>div:last-child]:ml-[5.5px] lg:last:[&>div:last-child]:-translate-x-full"
            >
              <div className="flex h-5 items-center gap-1 lg:h-auto lg:-translate-x-1/2">
                <span
                  className={cn(
                    "size-2.75 shrink-0 rounded-full ring-4 ring-[var(--site-primary)]",
                    current ? "bg-green" : "bg-white/45",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-5 -bottom-3 left-[4.75px] w-0.5 bg-white/35 lg:hidden"
                  />
                )}
              </div>
              <p className="lg:hidden">
                <span className={cn("font-semibold", current && "text-green")}>
                  {phase.description}
                </span>{" "}
                <span className="text-white/85">{phase.label}</span>
              </p>
              <div className="hidden lg:block lg:w-[min(10rem,12cqw)] lg:shrink-0 lg:-translate-x-1/2">
                <p className="text-white/85">{phase.label}</p>
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
