import { cn } from "./cn";
import { projectColor } from "./projectColor";

/** The square of a project's colour that sits before its name. Decorative: the name says which project. */
export function ProjectSwatch({
  projectId,
  className,
}: {
  projectId: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-xs",
        projectColor(projectId).solid,
        className,
      )}
    />
  );
}
