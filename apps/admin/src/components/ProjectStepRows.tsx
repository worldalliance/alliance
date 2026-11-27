import { projectTaskHref, taskHref } from "../lib/hrefs";
import type { ProjectStep } from "../lib/projectCards";

/** A task's page: under its project when it has one. */
export const stepPath = (step: Pick<ProjectStep, "id" | "project">) =>
  step.project
    ? projectTaskHref({ projectId: step.project.id, actionId: step.id })
    : taskHref(step.id);
