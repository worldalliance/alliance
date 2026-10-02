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
        className="mb-6 lg:sr-only"
      >
        Timeline
      </BandHeading>
      <ol className="site-sans flex flex-col gap-4 text-sm lg:grid lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.65fr)] lg:gap-0">
        {PHASES.map((phase, idx) => {
          const current = idx === currentIdx;
          const last = idx === PHASES.length - 1;
          return (
            <li
              key={phase.label}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3.5 lg:flex-col lg:gap-1.5"
            >
              <div className="flex h-5 items-center gap-1 lg:h-auto">
                <span
                  className={cn(
                    "size-2.75 shrink-0 rounded-full",
                    current ? "bg-green" : "bg-white/45",
                  )}
                />
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-5 -bottom-3 left-[4.75px] w-0.5 bg-white/35 lg:static lg:mr-1 lg:h-0.5 lg:w-auto lg:flex-1"
                  />
                )}
              </div>
              <p className="lg:hidden">
                <span className={cn("font-semibold", current && "text-green")}>
                  {phase.description}
                </span>{" "}
                <span className="text-white/85">{phase.label}</span>
              </p>
              <div className="hidden pr-4 lg:block">
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
