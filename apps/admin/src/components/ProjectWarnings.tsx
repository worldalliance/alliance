import { format, formatDistanceToNowStrict } from "date-fns";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { ProjectFlagKind, type ProjectFlag } from "../lib/projectCards";

const day = (date: Date) => format(date, "MMM d");
const relative = (date: Date) =>
  formatDistanceToNowStrict(date, { addSuffix: true });

const FLAG_TEXT: Record<ProjectFlagKind, (flag: ProjectFlag) => string> = {
  [ProjectFlagKind.Stuck]: ({ step, at }) =>
    `"${step.name}" has been wrapping up since ${day(at)} with no update`,
  [ProjectFlagKind.NoUpdate]: ({ step, at }) =>
    `"${step.name}" completed ${day(at)} with no update posted`,
  [ProjectFlagKind.DeadlineSoon]: ({ step, at }) =>
    `"${step.name}" closes ${relative(at)}`,
  [ProjectFlagKind.LaunchSoon]: ({ step, at }) =>
    `"${step.name}" opens ${relative(at)}`,
  [ProjectFlagKind.GapBeforeNextStep]: ({ step }) =>
    `Nothing planned after "${step.name}"`,
};

const icon = <TriangleAlert size={14} aria-hidden className="shrink-0" />;

const ProjectWarnings = ({
  flags,
  defaultOpen = false,
}: {
  flags: ProjectFlag[];
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  if (flags.length === 0) return null;
  const box = "rounded-md bg-amber-50 text-sm text-amber-900";
  if (flags.length === 1) {
    return (
      <p className={`${box} flex items-start gap-1.5 px-2 py-1`}>
        <span className="mt-0.5">{icon}</span>
        {FLAG_TEXT[flags[0].kind](flags[0])}
      </p>
    );
  }
  return (
    <div className={box}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        className="relative z-10 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left font-medium outline-hidden hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        {icon}
        {flags.length} warnings
        {open ? (
          <ChevronDown size={14} aria-hidden />
        ) : (
          <ChevronRight size={14} aria-hidden />
        )}
      </button>
      {open && (
        <ul
          id={listId}
          className="flex list-disc flex-col gap-1 pb-2 pl-9 pr-2"
        >
          {flags.map((flag) => (
            <li key={`${flag.kind}-${flag.step.id}`}>
              {FLAG_TEXT[flag.kind](flag)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectWarnings;
