import { cn } from "@alliance/shared/styles/util";
import { SiteArrow } from "@alliance/sharedweb/ui/SiteArrow";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  UPCOMING_PROJECTS,
  UPCOMING_PROJECTS_LABEL,
  type UpcomingProject,
} from "../content";

export const HIGHLIGHT_INTERVAL_MS = 4000;

const EASE_OUT_QUART =
  "motion-safe:duration-[600ms] motion-safe:ease-[cubic-bezier(0.25,1,0.5,1)]";

const LIST = "col-start-1 row-start-1 flex flex-col gap-4";

function cardClass(highlighted: boolean) {
  return cn(
    "flex items-stretch gap-5 rounded-lg border bg-white p-3 motion-safe:transition-[border-color,box-shadow] sm:p-4",
    EASE_OUT_QUART,
    highlighted
      ? "border-[var(--color-green)] shadow-lg"
      : "border-zinc-200 [&>*]:opacity-60",
  );
}

function progressLabel({ done, goal, unit }: UpcomingProject["progress"]) {
  return `${done.toLocaleString("en-US")}/${goal.toLocaleString("en-US")} ${unit}`;
}

function ProjectProgress({
  progress,
  open,
}: {
  progress: UpcomingProject["progress"];
  open: boolean;
}) {
  return (
    <div
      className={cn(
        "grid motion-safe:transition-[grid-template-rows,opacity]",
        EASE_OUT_QUART,
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="site-sans flex min-h-0 flex-col gap-1.5 overflow-hidden">
        <div
          aria-hidden
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-100 sm:h-2.5"
        >
          <div
            className="bg-green h-full rounded-full"
            style={{
              width: `${(Math.min(progress.done, progress.goal) / progress.goal) * 100}%`,
            }}
          />
        </div>
        <p className="text-sm text-[var(--site-ink)]/70">
          {progressLabel(progress)}
        </p>
      </div>
    </div>
  );
}

function CardBody({
  project,
  highlighted,
}: {
  project: UpcomingProject;
  highlighted: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "relative w-28 shrink-0 overflow-hidden rounded-md motion-safe:transition-[min-height,opacity] sm:w-40",
          EASE_OUT_QUART,
          highlighted ? "min-h-28 sm:min-h-30" : "min-h-20 sm:min-h-21",
        )}
      >
        <img
          src={project.imageSrc}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center motion-safe:transition-opacity",
          EASE_OUT_QUART,
        )}
      >
        <div className="flex items-start justify-between gap-3 text-xl leading-tight font-normal text-[var(--site-ink)] sm:text-2xl">
          <span>{project.title}</span>
          <SiteArrow className="mt-[calc((1.25em_-_0.75rem)/2)] size-3" />
        </div>
        <ProjectProgress progress={project.progress} open={highlighted} />
      </div>
    </>
  );
}

/**
 * The highlight moves on a timer and holds on whichever card is hovered or
 * focused. The cards resize as it moves, and their stack is briefly taller or
 * shorter mid-switch; it floats over invisible copies of each settled state,
 * which alone size the outer box, so the content below stays still.
 */
export function UpcomingProjects({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const id = setInterval(
      () => setActive((idx) => (idx + 1) % UPCOMING_PROJECTS.length),
      HIGHLIGHT_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [held]);
  const hold = (idx: number) => {
    setActive(idx);
    setHeld(true);
  };
  const release = () => setHeld(false);

  return (
    <div className={cn("relative grid", className)}>
      {UPCOMING_PROJECTS.map((openProject) => (
        <div
          key={openProject.href}
          aria-hidden
          inert
          className={cn(LIST, "invisible")}
        >
          {UPCOMING_PROJECTS.map((project) => (
            <div key={project.href} className={cardClass(false)}>
              <CardBody
                project={project}
                highlighted={project === openProject}
              />
            </div>
          ))}
        </div>
      ))}
      <ul
        aria-label={UPCOMING_PROJECTS_LABEL}
        className={cn(LIST, "absolute inset-x-0 top-0")}
      >
        {UPCOMING_PROJECTS.map((project, idx) => {
          const highlighted = idx === active;
          return (
            <li key={project.href}>
              <Link
                to={project.href}
                data-highlighted={highlighted || undefined}
                onMouseEnter={() => hold(idx)}
                onMouseLeave={release}
                onFocus={() => hold(idx)}
                onBlur={release}
                className={cardClass(highlighted)}
              >
                <CardBody project={project} highlighted={highlighted} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
